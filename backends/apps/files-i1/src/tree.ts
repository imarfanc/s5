import { run } from "../shared/process.ts";
import {
  boolField,
  commandLine,
  jsonError,
  numberField,
  PathError,
  readJson,
  resolvePath,
  stringField,
} from "./paths.ts";

export async function runTree(options: {
  root: string;
  depth: number;
  dirsOnly: boolean;
  hidden: boolean;
}): Promise<{ text: string; missing: boolean; command: string }> {
  const root = await resolvePath(options.root);
  const depth = Math.min(Math.max(options.depth || 2, 1), 8);
  const args = ["-C", "-L", String(depth), "-F"];
  if (options.hidden) args.push("-a");
  if (options.dirsOnly) args.push("-d");
  args.push(root);
  const command = commandLine("tree", args);
  const result = await run("tree", args, {
    env: {
      PATH: Deno.env.get("PATH") ?? "/usr/bin:/bin:/opt/homebrew/bin",
      HOME: Deno.env.get("HOME") ?? "",
      TERM: "xterm-256color",
      CLICOLOR_FORCE: "1",
      FORCE_COLOR: "1",
    },
  });
  if (result.code === 127) return { text: "", missing: true, command };
  if (!result.success) {
    throw new PathError(result.stderr.trim() || `tree exited ${result.code}`, 500);
  }
  return { text: result.stdout, missing: false, command };
}

export async function treeHandler(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    return Response.json(
      await runTree({
        root: stringField(body, "root") || "~",
        depth: numberField(body, "depth", 2),
        dirsOnly: boolField(body, "dirsOnly"),
        hidden: boolField(body, "hidden", true),
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
