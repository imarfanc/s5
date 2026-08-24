import { run } from "../shared/process.ts";
import { commandLine, jsonError, PathError } from "./paths.ts";

export const COMMAND_NAME = /^[A-Za-z0-9._+-]{1,64}$/;

export function validateCommandName(name: string): string {
  const trimmed = name.trim();
  if (!COMMAND_NAME.test(trimmed)) {
    throw new PathError("command must match [A-Za-z0-9._+-]{1,64}");
  }
  if (trimmed.startsWith("-")) throw new PathError("command cannot start with a dash");
  if (trimmed.includes("..")) throw new PathError("command cannot contain ..");
  return trimmed;
}

export async function runDoc(
  command: string,
  source: "man" | "tldr",
): Promise<{ text: string; missing: boolean; source: "man" | "tldr"; command: string }> {
  const name = validateCommandName(command);
  if (source === "tldr") {
    const cmdline = commandLine("tldr", ["--color", name]);
    const result = await run("tldr", ["--color", name], {
      env: {
        PATH: Deno.env.get("PATH") ?? "/usr/bin:/bin",
        HOME: Deno.env.get("HOME") ?? "",
        FORCE_COLOR: "1",
        CLICOLOR_FORCE: "1",
        TERM: "xterm-256color",
      },
    });
    if (result.code === 127) return { text: "", missing: true, source, command: cmdline };
    if (!result.success) {
      throw new PathError(
        result.stderr.trim() || result.stdout.trim() || `tldr exited ${result.code}`,
        404,
      );
    }
    return { text: result.stdout, missing: false, source, command: cmdline };
  }

  const manLine = `${commandLine("man", [name])} | ${commandLine("col", ["-bx"])}`;
  const result = await run("man", [name], {
    env: {
      PATH: Deno.env.get("PATH") ?? "/usr/bin:/bin",
      HOME: Deno.env.get("HOME") ?? "",
      MANPAGER: "cat",
      MANWIDTH: "100",
      PAGER: "cat",
    },
  });
  if (result.code === 127) return { text: "", missing: true, source, command: manLine };
  if (!result.success) {
    throw new PathError(result.stderr.trim() || `man exited ${result.code}`, 404);
  }
  const cleaned = await run("col", ["-bx"], { input: result.stdout });
  const text = cleaned.success ? cleaned.stdout : result.stdout;
  return { text, missing: false, source, command: manLine };
}

export async function docHandler(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const command = url.searchParams.get("command") ?? "";
    const source = url.searchParams.get("source") === "tldr" ? "tldr" : "man";
    return Response.json(await runDoc(command, source));
  } catch (error) {
    return jsonError(error);
  }
}
