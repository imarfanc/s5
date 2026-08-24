/** Spawn subprocesses with inherited or captured stdout and stderr. */
export interface CommandResult {
  success: boolean;
  code: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd?: string;
  inherit?: boolean;
  env?: Record<string, string>;
  /** Piped to stdin, then the writer is closed. */
  input?: string;
}

/** True when `command` can be spawned (on PATH, or an absolute path). */
export async function commandExists(command: string): Promise<boolean> {
  const probes: string[][] = command === "man" ? [["-w", "man"]] : [["--version"], ["-v"], ["-V"]];
  for (const args of probes) {
    try {
      await new Deno.Command(command, {
        args,
        stdin: "null",
        stdout: "null",
        stderr: "null",
      }).output();
      return true;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return false;
    }
  }
  return true;
}

export async function run(
  command: string,
  args: string[],
  options: RunOptions = {},
): Promise<CommandResult> {
  const inherit = options.inherit === true;
  const piped = options.input !== undefined;
  try {
    const cmd = new Deno.Command(command, {
      args,
      cwd: options.cwd,
      env: options.env,
      stdin: piped ? "piped" : inherit ? "inherit" : "null",
      stdout: inherit ? "inherit" : "piped",
      stderr: inherit ? "inherit" : "piped",
    });
    const decoder = new TextDecoder();
    if (piped) {
      const child = cmd.spawn();
      const writer = child.stdin.getWriter();
      await writer.write(new TextEncoder().encode(options.input));
      await writer.close();
      const output = await child.output();
      return {
        success: output.success,
        code: output.code,
        stdout: decoder.decode(output.stdout),
        stderr: decoder.decode(output.stderr),
      };
    }
    const output = await cmd.output();
    return {
      success: output.success,
      code: output.code,
      stdout: inherit ? "" : decoder.decode(output.stdout),
      stderr: inherit ? "" : decoder.decode(output.stderr),
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return {
        success: false,
        code: 127,
        stdout: "",
        stderr: `${command} is not installed`,
      };
    }
    throw error;
  }
}
