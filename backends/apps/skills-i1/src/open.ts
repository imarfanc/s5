import { exists } from "./fs.ts";
import type { Opener } from "./settings.ts";

export interface OpenResult {
  ok: boolean;
  message: string;
}

/**
 * Hand a directory to a local app. The command comes from `skills.config.json`
 * and the path from the app's own resolution — the request only names an opener
 * by id, so nothing a browser sends becomes part of the command line.
 */
export async function openDirectory(opener: Opener, path: string): Promise<OpenResult> {
  if (!await exists(path)) {
    return { ok: false, message: `Nothing at ${path} yet — install a skill first.` };
  }
  const [command, ...rest] = opener.command;
  if (!command) return { ok: false, message: `${opener.label} has no command configured.` };
  const args = rest.map((argument) => argument.replaceAll("{path}", path));
  try {
    const { success, stderr } = await new Deno.Command(command, {
      args,
      stdout: "null",
      stderr: "piped",
    }).output();
    if (success) return { ok: true, message: `Opened in ${opener.label}` };
    const detail = new TextDecoder().decode(stderr).trim().split("\n")[0] ?? "";
    return { ok: false, message: `${opener.label} failed: ${detail || "non-zero exit"}` };
  } catch {
    return { ok: false, message: `${opener.label} not found — is \`${command}\` on your PATH?` };
  }
}
