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

export interface SearchHit {
  file: string;
  line: number;
  column: number;
  text: string;
}

export function parseRgJson(stdout: string, limit: number): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    let event: { type?: string; data?: Record<string, unknown> };
    try {
      event = JSON.parse(raw);
    } catch {
      continue;
    }
    if (event.type !== "match" || !event.data) continue;
    const pathObj = event.data.path as { text?: string } | undefined;
    const file = pathObj?.text;
    if (!file) continue;
    const lineNumber = Number(event.data.line_number ?? 0);
    const lines = event.data.lines as { text?: string } | undefined;
    const submatches = event.data.submatches as Array<{ start?: number }> | undefined;
    hits.push({
      file,
      line: lineNumber,
      column: (submatches?.[0]?.start ?? 0) + 1,
      text: (lines?.text ?? "").replace(/\n$/, ""),
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

export async function runSearch(options: {
  root: string;
  query: string;
  regex: boolean;
  caseSensitive: boolean;
  glob: string;
  hidden: boolean;
  max: number;
}): Promise<{ hits: SearchHit[]; truncated: boolean; missing: boolean; command: string }> {
  const root = await resolvePath(options.root);
  if (!options.query) throw new PathError("query is required");
  const max = Math.min(Math.max(options.max, 1), 2000);
  const args = ["--json", "--max-count", "20", "--max-filesize", "2M"];
  if (!options.regex) args.push("--fixed-strings");
  if (!options.caseSensitive) args.push("--ignore-case");
  if (options.hidden) args.push("--hidden");
  if (options.glob) args.push("--glob", options.glob);
  args.push("--", options.query, root);
  const command = commandLine("rg", args);
  const result = await run("rg", args);
  if (result.code === 127) return { hits: [], truncated: false, missing: true, command };
  if (result.code !== 0 && result.code !== 1) {
    throw new PathError(result.stderr.trim() || `rg exited ${result.code}`, 500);
  }
  const hits = parseRgJson(result.stdout, max);
  return { hits, truncated: hits.length >= max, missing: false, command };
}

export async function searchHandler(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const result = await runSearch({
      root: stringField(body, "root") || "~",
      query: stringField(body, "query"),
      regex: boolField(body, "regex"),
      caseSensitive: boolField(body, "caseSensitive"),
      glob: stringField(body, "glob"),
      hidden: boolField(body, "hidden"),
      max: numberField(body, "max", 2000),
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
