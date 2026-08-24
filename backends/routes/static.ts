/**
 * Static file serving for `public/` and `Apps/`.
 *
 * Two roots, one rule each: everything under `/apps/` comes from `Apps/`,
 * everything else from `public/`. Reads go through `../files.ts` so this works
 * both locally and on Val Town.
 */

import { serve } from "../files.ts";

/** Reject `..`, empty segments, and NUL so a URL cannot escape its root. */
function safeSegments(pathname: string): string[] | null {
  const decoded = decodeURIComponent(pathname);
  if (decoded.includes("\0")) return null;
  const segments = decoded.split("/").filter(Boolean);
  return segments.some((segment) => segment === "." || segment === "..") ? null : segments;
}

/**
 * Serve `pathname` from `root`, treating a directory as its `index.html` so
 * that `/apps/main/todo2` and `/apps/main/todo2/` both work.
 */
async function serveFrom(root: string, pathname: string): Promise<Response | null> {
  const segments = safeSegments(pathname);
  if (!segments) return null;

  const base = [root, ...segments].join("/");
  const last = segments.at(-1);
  const isFile = last?.includes(".") ?? false;

  if (segments.length === 0 || !isFile) {
    return await serve(`${base}/index.html`.replace(/\/+/g, "/"));
  }
  return await serve(base);
}

export async function handleStatic(request: Request): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const { pathname } = new URL(request.url);
  if (pathname === "/apps" || pathname.startsWith("/apps/")) {
    return await serveFrom("Apps", pathname.slice("/apps".length));
  }
  return await serveFrom("public", pathname);
}
