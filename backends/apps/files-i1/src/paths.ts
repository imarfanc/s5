import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";

export class PathError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "PathError";
  }
}

const DENY_REL = ["Library", ".Trash", "Applications", ".ssh", ".gnupg"];

const XCODE_ALLOW_REL = [
  "Library/Developer/Xcode/DerivedData",
  "Library/Developer/Xcode/Archives",
  "Library/Developer/CoreSimulator/Caches",
  "Library/Caches/org.swift.swiftpm",
];

export function homeDir(): string {
  const home = Deno.env.get("HOME")?.trim();
  if (!home) throw new PathError("HOME is not set", 500);
  return home.replace(/\/+$/, "");
}

export function expandHome(path: string): string {
  const home = homeDir();
  if (path === "~") return home;
  if (path.startsWith("~/")) return join(home, path.slice(2));
  if (path.includes("${HOME}")) return path.replaceAll("${HOME}", home);
  if (path.includes("$HOME")) return path.replaceAll("$HOME", home);
  return path;
}

export function denyPrefixes(): string[] {
  return DENY_REL.map((name) => join(homeDir(), name));
}

export function xcodeAllowPrefixes(): string[] {
  return XCODE_ALLOW_REL.map((name) => join(homeDir(), name));
}

/** True when `child` is `parent` or a descendant of it. */
export function isUnder(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function isXcodeAllowed(real: string): boolean {
  return xcodeAllowPrefixes().some((prefix) => isUnder(prefix, real));
}

async function canonicalize(path: string): Promise<string> {
  try {
    return await Deno.realPath(path);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  let cursor = path;
  const missing: string[] = [];
  while (true) {
    const parent = dirname(cursor);
    if (parent === cursor) break;
    missing.unshift(cursor.slice(parent.length));
    try {
      return normalize(
        join(await Deno.realPath(parent), ...missing.map((part) => part.replace(/^\//, ""))),
      );
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
      cursor = parent;
    }
  }
  return normalize(path);
}

export interface ResolveOptions {
  /** Permit the Xcode cache allowlist inside ~/Library. */
  allowXcode?: boolean;
  /** Refuse $HOME itself (used by trash). */
  forDelete?: boolean;
}

export async function resolvePath(input: string, options: ResolveOptions = {}): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) throw new PathError("path is required");
  const home = homeDir();
  let raw = expandHome(trimmed);
  if (!isAbsolute(raw)) raw = resolve(home, raw);
  const real = await canonicalize(raw);

  if (!isUnder(home, real)) throw new PathError("path is outside $HOME");
  if (options.forDelete && real === home) throw new PathError("refusing to trash $HOME");

  for (const prefix of denyPrefixes()) {
    if (!isUnder(prefix, real)) continue;
    if (options.allowXcode && isXcodeAllowed(real)) continue;
    throw new PathError(`path is blocked: ${prefix}`);
  }
  return real;
}

const lastScan = new Set<string>();

export function rememberScan(paths: string[]): void {
  lastScan.clear();
  for (const path of paths) lastScan.add(path);
}

export function wasScanned(path: string): boolean {
  return lastScan.has(path);
}

export function jsonError(error: unknown): Response {
  if (error instanceof PathError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : String(error);
  return Response.json({ error: message }, { status: 500 });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new PathError("expected JSON body");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PathError("expected a JSON object");
  }
  return body as Record<string, unknown>;
}

export function stringField(body: Record<string, unknown>, key: string, fallback = ""): string {
  const value = body[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw new PathError(`${key} must be a string`);
  return value;
}

export function boolField(body: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = body[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new PathError(`${key} must be a boolean`);
  return value;
}

/** Shell-quote argv so the UI can show the process that actually ran. */
export function commandLine(command: string, args: string[] = []): string {
  return [command, ...args.map(shellToken)].join(" ");
}

function shellToken(value: string): string {
  if (/^[A-Za-z0-9_./:=+@%,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function numberField(
  body: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = body[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PathError(`${key} must be a number`);
  }
  return value;
}
