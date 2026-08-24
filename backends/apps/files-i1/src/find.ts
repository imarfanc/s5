import { run } from "../shared/process.ts";
import {
  boolField,
  commandLine,
  jsonError,
  numberField,
  PathError,
  readJson,
  rememberScan,
  resolvePath,
  stringField,
} from "./paths.ts";

export type FdKind = "file" | "dir" | "symlink" | "any";

export interface FindOptions {
  root: string;
  pattern: string;
  kind: FdKind;
  ext: string;
  hidden: boolean;
  depth: number;
  changedWithin: string;
}

export function fdArgs(options: FindOptions, root: string): string[] {
  const args = ["--absolute-path", "--color=never"];
  if (options.kind === "file") args.push("--type", "f");
  else if (options.kind === "dir") args.push("--type", "d");
  else if (options.kind === "symlink") args.push("--type", "l");
  if (options.ext) args.push("--extension", options.ext);
  if (options.hidden) args.push("--hidden");
  if (options.depth > 0) args.push("--max-depth", String(options.depth));
  if (options.changedWithin) args.push("--changed-within", options.changedWithin);
  args.push("--", options.pattern || ".", root);
  return args;
}

export async function runFind(
  options: FindOptions,
): Promise<{ paths: string[]; missing: boolean; command: string }> {
  const root = await resolvePath(options.root);
  const args = fdArgs(options, root);
  const command = commandLine("fd", args);
  const result = await run("fd", args);
  if (result.code === 127) return { paths: [], missing: true, command };
  if (!result.success && result.code !== 1) {
    throw new PathError(result.stderr.trim() || `fd exited ${result.code}`, 500);
  }
  const paths = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  rememberScan(paths);
  return { paths, missing: false, command };
}

export async function runFuzzy(options: {
  root: string;
  query: string;
  source: "files" | "dirs";
}): Promise<{ paths: string[]; missing: string | null; command: string }> {
  const root = await resolvePath(options.root);
  const kind: FdKind = options.source === "dirs" ? "dir" : "file";
  const fd = fdArgs({
    root: options.root,
    pattern: ".",
    kind,
    ext: "",
    hidden: false,
    depth: 0,
    changedWithin: "",
  }, root);
  const listed = await run("fd", fd);
  const fdLine = commandLine("fd", fd);
  if (listed.code === 127) return { paths: [], missing: "fd", command: fdLine };
  const candidates = listed.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!options.query) {
    rememberScan(candidates);
    return { paths: candidates, missing: null, command: fdLine };
  }
  const fzfArgs = ["--filter", options.query, "--no-sort"];
  const command = `${fdLine} | ${commandLine("fzf", fzfArgs)}`;
  const filtered = await run("fzf", fzfArgs, {
    input: candidates.join("\n") + "\n",
  });
  if (filtered.code === 127) return { paths: [], missing: "fzf", command };
  const paths = filtered.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  rememberScan(paths);
  return { paths, missing: null, command };
}

export async function findHandler(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const kindRaw = stringField(body, "kind") || "any";
    const kind: FdKind = kindRaw === "file" || kindRaw === "dir" || kindRaw === "symlink"
      ? kindRaw
      : "any";
    return Response.json(
      await runFind({
        root: stringField(body, "root") || "~",
        pattern: stringField(body, "pattern"),
        kind,
        ext: stringField(body, "ext"),
        hidden: boolField(body, "hidden"),
        depth: numberField(body, "depth", 0),
        changedWithin: stringField(body, "changedWithin"),
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function fuzzyHandler(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const source = stringField(body, "source") === "dirs" ? "dirs" : "files";
    return Response.json(
      await runFuzzy({
        root: stringField(body, "root") || "~",
        query: stringField(body, "query"),
        source,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
