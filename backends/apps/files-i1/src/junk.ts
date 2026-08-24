import { join } from "node:path";
import { commandExists, run } from "../shared/process.ts";
import {
  commandLine,
  isUnder,
  jsonError,
  PathError,
  readJson,
  rememberScan,
  resolvePath,
  stringField,
  wasScanned,
  xcodeAllowPrefixes,
} from "./paths.ts";

export type ScanKind = "ds_store" | "node_modules" | "xcode";

export interface ScanItem {
  path: string;
  size: number;
  count: number;
}

const SKIP_WHEN_WALKING = new Set([".git", ".Trash"]);

async function dirSize(path: string): Promise<number> {
  const du = await run("du", ["-sk", path]);
  const match = du.stdout.trim().match(/^(\d+)/);
  if (match?.[1]) return Number(match[1]) * 1024;
  try {
    return Number((await Deno.lstat(path)).size);
  } catch {
    return 0;
  }
}

async function walkNamed(
  root: string,
  match: (name: string, isDir: boolean) => boolean,
  options: { stopOnMatch: boolean },
): Promise<string[]> {
  const found: string[] = [];
  async function visit(dir: string): Promise<void> {
    const entries: Deno.DirEntry[] = [];
    try {
      for await (const entry of Deno.readDir(dir)) entries.push(entry);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_WHEN_WALKING.has(entry.name)) continue;
      const path = join(dir, entry.name);
      const matched = match(entry.name, entry.isDirectory);
      if (matched) found.push(path);
      if (entry.isDirectory && !(options.stopOnMatch && matched)) await visit(path);
    }
  }
  await visit(root);
  return found;
}

async function listDir(path: string): Promise<string[]> {
  const out: string[] = [];
  try {
    for await (const entry of Deno.readDir(path)) out.push(join(path, entry.name));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return [];
    throw error;
  }
  return out;
}

export async function scanKind(
  root: string,
  kind: ScanKind,
): Promise<{ items: ScanItem[]; totalSize: number; command: string }> {
  const real = await resolvePath(root, { allowXcode: kind === "xcode" });
  let paths: string[] = [];
  let command = "";
  if (kind === "ds_store") {
    command = commandLine("find", [real, "-name", ".DS_Store"]);
    paths = await walkNamed(real, (name, isDir) => !isDir && name === ".DS_Store", {
      stopOnMatch: false,
    });
  } else if (kind === "node_modules") {
    command = commandLine("find", [real, "-type", "d", "-name", "node_modules"]);
    paths = await walkNamed(real, (name, isDir) => isDir && name === "node_modules", {
      stopOnMatch: true,
    });
  } else {
    const underRoot = await walkNamed(
      real,
      (name, isDir) => isDir && (name === "DerivedData" || name === ".build"),
      { stopOnMatch: true },
    );
    const fromLibrary: string[] = [];
    for (const prefix of xcodeAllowPrefixes()) {
      if (isUnder(real, prefix) || isUnder(prefix, real)) {
        fromLibrary.push(...await listDir(isUnder(real, prefix) ? prefix : real));
      }
    }
    const home = (Deno.env.get("HOME") ?? "").replace(/\/+$/, "");
    if (real === home) {
      fromLibrary.length = 0;
      for (const prefix of xcodeAllowPrefixes()) {
        fromLibrary.push(...await listDir(prefix));
      }
    }
    paths = [...new Set([...underRoot, ...fromLibrary])];
    command = [
      commandLine("find", [
        real,
        "(",
        "-name",
        "DerivedData",
        "-o",
        "-name",
        ".build",
        ")",
        "-type",
        "d",
      ]),
      ...xcodeAllowPrefixes().map((prefix) => commandLine("ls", [prefix])),
    ].join(" ; ");
  }

  const items: ScanItem[] = [];
  let totalSize = 0;
  for (const path of paths) {
    const size = await dirSize(path);
    totalSize += size;
    items.push({ path, size, count: 1 });
  }
  items.sort((a, b) => b.size - a.size);
  rememberScan(items.map((item) => item.path));
  return { items, totalSize, command: `${command} ; du -sk …` };
}

function posixQuote(path: string): string {
  return `'${path.replaceAll("'", "'\\''")}'`;
}

async function moveToTrash(paths: string[]): Promise<string> {
  if (await commandExists("trash")) {
    const result = await run("trash", paths);
    if (!result.success) {
      throw new PathError(result.stderr.trim() || `trash exited ${result.code}`, 500);
    }
    return commandLine("trash", paths);
  }
  const list = paths.map((path) => `POSIX file ${posixQuote(path)}`).join(", ");
  const script = `tell application "Finder" to delete {${list}}`;
  const result = await run("osascript", ["-e", script]);
  if (!result.success) {
    throw new PathError(result.stderr.trim() || `osascript exited ${result.code}`, 500);
  }
  return commandLine("osascript", ["-e", script]);
}

export async function trashPaths(
  paths: string[],
): Promise<{ results: { path: string; ok: boolean; error?: string }[]; command: string }> {
  const results: { path: string; ok: boolean; error?: string }[] = [];
  const accepted: string[] = [];
  for (const input of paths) {
    try {
      const real = await resolvePath(input, { forDelete: true, allowXcode: true });
      if (!wasScanned(real)) throw new PathError("path was not in the last scan");
      accepted.push(real);
    } catch (error) {
      results.push({
        path: input,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  let command = "";
  if (accepted.length > 0) {
    try {
      command = await moveToTrash(accepted);
      for (const path of accepted) results.push({ path, ok: true });
      rememberScan([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const path of accepted) results.push({ path, ok: false, error: message });
    }
  }
  return { results, command };
}

export async function scanHandler(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const kind = stringField(body, "kind") as ScanKind;
    if (kind !== "ds_store" && kind !== "node_modules" && kind !== "xcode") {
      throw new PathError("kind must be ds_store, node_modules, or xcode");
    }
    return Response.json(await scanKind(stringField(body, "root") || "~", kind));
  } catch (error) {
    return jsonError(error);
  }
}

export async function trashHandler(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const paths = body.paths;
    if (!Array.isArray(paths) || paths.some((item) => typeof item !== "string")) {
      throw new PathError("paths must be an array of strings");
    }
    return Response.json(await trashPaths(paths));
  } catch (error) {
    return jsonError(error);
  }
}
