import { join } from "node:path";
import { run } from "../shared/process.ts";
import {
  commandLine,
  jsonError,
  numberField,
  readJson,
  resolvePath,
  stringField,
} from "./paths.ts";

export interface SizeEntry {
  name: string;
  path: string;
  isDir: boolean;
  bytes: number;
}

function parseDuKilobytes(stdout: string): number | null {
  const match = stdout.trim().match(/^(\d+)/);
  if (!match?.[1]) return null;
  return Number(match[1]) * 1024;
}

async function childSize(path: string): Promise<number> {
  const du = await run("du", ["-sk", path]);
  const parsed = parseDuKilobytes(du.stdout);
  if (parsed !== null) return parsed;
  try {
    const info = await Deno.lstat(path);
    if (info.isFile) return Number(info.size);
  } catch {
    return 0;
  }
  return 0;
}

export async function listSizes(
  root: string,
): Promise<{ path: string; total: number; entries: SizeEntry[]; command: string }> {
  const real = await resolvePath(root);
  const entries: SizeEntry[] = [];
  let total = 0;
  for await (const entry of Deno.readDir(real)) {
    const child = join(real, entry.name);
    const bytes = await childSize(child);
    total += bytes;
    entries.push({
      name: entry.name,
      path: child,
      isDir: entry.isDirectory,
      bytes,
    });
  }
  entries.sort((a, b) => b.bytes - a.bytes);
  return {
    path: real,
    total,
    entries,
    command: `${commandLine("du", ["-sk"])} ${real}/*`,
  };
}

export { parseDuKilobytes };

export async function sizesHandler(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const root = stringField(body, "root") || "~";
    numberField(body, "depth", 1);
    return Response.json(await listSizes(root));
  } catch (error) {
    return jsonError(error);
  }
}
