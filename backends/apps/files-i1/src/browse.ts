import { join } from "node:path";
import { denyPrefixes, jsonError, PathError, readJson, resolvePath, stringField } from "./paths.ts";

export interface BrowseEntry {
  name: string;
  path: string;
  isDir: boolean;
  isFile: boolean;
  hidden: boolean;
  size: number | null;
  mtime: number | null;
}

export interface BrowseView {
  path: string;
  parent: string | null;
  home: string;
  entries: BrowseEntry[];
}

export async function browseDir(path: string): Promise<BrowseView> {
  const real = await resolvePath(path);
  const stat = await Deno.stat(real);
  if (!stat.isDirectory) throw new PathError("not a directory");
  const home = Deno.env.get("HOME") ?? "";
  const parentDir = real === home ? null : join(real, "..");
  let parent: string | null = null;
  if (parentDir) {
    try {
      parent = await resolvePath(parentDir);
    } catch {
      parent = null;
    }
  }

  const blocked = new Set(denyPrefixes());
  const entries: BrowseEntry[] = [];
  for await (const entry of Deno.readDir(real)) {
    const child = join(real, entry.name);
    if (blocked.has(child)) continue;
    let size: number | null = null;
    let mtime: number | null = null;
    try {
      const info = await Deno.lstat(child);
      size = info.isFile ? Number(info.size) : null;
      mtime = info.mtime ? info.mtime.getTime() : null;
    } catch {
      // unreadable
    }
    entries.push({
      name: entry.name,
      path: child,
      isDir: entry.isDirectory,
      isFile: entry.isFile,
      hidden: entry.name.startsWith("."),
      size,
      mtime,
    });
  }
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { path: real, parent, home, entries };
}

export async function browseHandler(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.searchParams.get("path") || "~";
    return Response.json(await browseDir(path));
  } catch (error) {
    return jsonError(error);
  }
}

export async function openInFinder(path: string): Promise<void> {
  const real = await resolvePath(path, { allowXcode: true });
  const result = await new Deno.Command("open", { args: ["-R", real], stderr: "piped" }).output();
  if (!result.success) {
    const detail = new TextDecoder().decode(result.stderr).trim();
    throw new PathError(detail || `open exited ${result.code}`, 500);
  }
}

export async function openHandler(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const path = stringField(body, "path");
    if (!path) throw new PathError("path is required");
    await openInFinder(path);
    return Response.json({ ok: true, path });
  } catch (error) {
    return jsonError(error);
  }
}
