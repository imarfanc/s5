/**
 * Repository file inventory over HTTP: `GET /api/files`.
 *
 * The app only needs paths, not file contents. Authentication is already
 * settled by `routes/router.ts` before this handler runs.
 */

import { listPaths } from "../files.ts";

const ROUTE = "/api/files";
const SKIP_PATHS = new Set(["_other", ".vscode", ".vt", ".env", ".DS_Store"]);

function visible(path: string): boolean {
  return !path.split("/").some((segment) => SKIP_PATHS.has(segment));
}

export async function handleProjectFiles(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (pathname !== ROUTE) return null;

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed\n", {
      status: 405,
      headers: { allow: "GET, HEAD" },
    });
  }

  try {
    const files = (await listPaths()).filter(visible).sort((a, b) => a.localeCompare(b));
    return Response.json(
      { files, count: files.length, skipped: [...SKIP_PATHS] },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `Could not list project files: ${message}` }, { status: 500 });
  }
}
