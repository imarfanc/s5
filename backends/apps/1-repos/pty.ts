import { config } from "./config.ts";

/**
 * A shell attached to a pseudo-terminal.
 *
 * Deno has no PTY binding, so `script` supplies one: it is present on macOS and
 * Linux and its only job is to run a command with a tty attached. Without it the
 * shell sees a pipe, disables its prompt, and line editing stops working.
 *
 * `script` copies the parent's window size, and a piped stdin reports 0×0.
 * zsh then cannot redraw the line (Up goes blank) and prints `%` before every
 * prompt. `stty` on the slave sets a real size and later follows the browser.
 */
export interface Pty {
  readonly pid: number;
  readonly output: ReadableStream<Uint8Array>;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): Promise<void>;
}

export interface PtySize {
  cols: number;
  rows: number;
}

export type PromptStyle = "native" | "blocks" | "arrow";

export function parsePromptStyle(value: string | null): PromptStyle {
  if (value === "blocks" || value === "arrow") return value;
  return "native";
}

const running = new Set<Pty>();

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function sanitizeSize(cols: number, rows: number): PtySize {
  return { cols: clamp(cols, 2, 512, 80), rows: clamp(rows, 1, 256, 24) };
}

function backendPath(name: string): string {
  return decodeURIComponent(new URL(name, import.meta.url).pathname);
}

function shellInvocation(promptStyle: PromptStyle, env: Record<string, string>): string {
  const shellName = config.shell.split("/").at(-1);
  const args = [config.shell];
  if (promptStyle !== "native" && shellName === "zsh") {
    // .zshenv and .zshrc in this folder wrap the user's own; see their comments.
    env.CMUX1_DIR = backendPath(".").replace(/\/$/, "");
    env.CMUX1_ORIGINAL_ZDOTDIR = env.ZDOTDIR ?? "";
    env.CMUX1_PROMPT = promptStyle;
    env.ZDOTDIR = env.CMUX1_DIR;
  } else if (promptStyle !== "native" && shellName === "bash") {
    env.CMUX1_PROMPT = promptStyle;
    args.push("--rcfile", backendPath("bashrc"));
  }
  return args.map((arg) => JSON.stringify(arg)).join(" ");
}

function ptyCommand(size: PtySize, promptStyle: PromptStyle): Deno.Command {
  // Some parent applications export NO_COLOR. A terminal created here is an
  // interactive true-color tty, so keep the rest of the environment but make
  // its color capability explicit.
  const env = { ...Deno.env.toObject() };
  delete env.NO_COLOR;
  delete env.FORCE_COLOR;
  Object.assign(env, {
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    CLICOLOR: "1",
    CLICOLOR_FORCE: "1",
    // zsh paints this inverted mark when it thinks a program omitted a newline.
    PROMPT_EOL_MARK: "",
  });
  const shell = shellInvocation(promptStyle, env);
  const command = `stty cols ${size.cols} rows ${size.rows} 2>/dev/null; exec ${shell}`;
  const args = Deno.build.os === "darwin"
    ? ["-q", "/dev/null", "/bin/sh", "-c", command]
    : ["-qfec", `/bin/sh -c ${JSON.stringify(command)}`, "/dev/null"];
  return new Deno.Command("script", {
    args,
    stdin: "piped",
    stdout: "piped",
    stderr: "null",
    clearEnv: true,
    env,
  });
}

async function processTree(root: number): Promise<number[]> {
  try {
    const { stdout } = await new Deno.Command("ps", {
      args: ["-eo", "pid=,ppid="],
      stdout: "piped",
      stderr: "null",
    }).output();
    const children = new Map<number, number[]>();
    for (const row of new TextDecoder().decode(stdout).trim().split("\n")) {
      const [pid, parent] = row.trim().split(/\s+/).map(Number);
      if (!pid || !parent) continue;
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent)!.push(pid);
    }
    const result: number[] = [];
    const visit = (pid: number) => {
      for (const child of children.get(pid) ?? []) visit(child);
      if (pid !== root) result.push(pid);
    };
    visit(root);
    return result;
  } catch {
    return [];
  }
}

function ttyPath(psTty: string): string | undefined {
  const name = psTty.trim();
  if (!name || name.includes("?")) return undefined;
  if (name.startsWith("/")) return name;
  return `/dev/${name}`;
}

async function ttyOf(pid: number): Promise<string | undefined> {
  const { stdout } = await new Deno.Command("ps", {
    args: ["-o", "tty=", "-p", String(pid)],
    stdout: "piped",
    stderr: "null",
  }).output();
  return ttyPath(new TextDecoder().decode(stdout));
}

async function findSlave(scriptPid: number): Promise<string | undefined> {
  for (let attempt = 0; attempt < 40; attempt++) {
    // `script` inherits the launcher's tty when the server was started from a
    // terminal. Its deepest child owns the new PTY slave that xterm must resize.
    const pids = await processTree(scriptPid);
    for (const pid of pids) {
      const tty = await ttyOf(pid);
      if (tty) return tty;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return undefined;
}

function applySize(tty: string, size: PtySize): void {
  const flag = Deno.build.os === "darwin" ? "-f" : "-F";
  void new Deno.Command("stty", {
    args: [flag, tty, "cols", String(size.cols), "rows", String(size.rows)],
    stdin: "null",
    stdout: "null",
    stderr: "null",
  }).output().catch(() => {});
}

export function spawnPty(cols = 80, rows = 24, promptStyle: PromptStyle = "native"): Pty {
  const size = sanitizeSize(cols, rows);
  const child = ptyCommand(size, promptStyle).spawn();
  const writer = child.stdin.getWriter();
  const encoder = new TextEncoder();
  let alive = true;
  let killed = false;
  let slave: string | undefined;

  const pty: Pty = {
    pid: child.pid,
    output: child.stdout,
    write(data) {
      if (!alive) return;
      writer.write(encoder.encode(data)).catch(() => pty.kill());
    },
    resize(nextCols, nextRows) {
      const next = sanitizeSize(nextCols, nextRows);
      size.cols = next.cols;
      size.rows = next.rows;
      if (slave) applySize(slave, size);
    },
    async kill() {
      if (killed) return;
      killed = true;
      alive = false;
      running.delete(pty);
      const descendants = await processTree(child.pid);
      await writer.close().catch(() => {});
      for (const pid of descendants) {
        try {
          Deno.kill(pid, "SIGKILL");
        } catch {
          // The descendant exited while the tree was being collected.
        }
      }
      try {
        child.kill("SIGKILL");
      } catch {
        // Already gone.
      }
    },
  };

  running.add(pty);
  child.status.then(() => {
    alive = false;
    running.delete(pty);
  });
  void findSlave(child.pid).then((path) => {
    if (!alive || !path) return;
    slave = path;
    applySize(path, size);
  }).catch(() => {
    // Bootstrap stty already set the size; later resizes no-op without a slave.
  });
  return pty;
}

/** Kill every shell this process started, so the port never outlives its children. */
export async function killAllPtys(): Promise<void> {
  await Promise.all([...running].map((pty) => pty.kill()));
}
