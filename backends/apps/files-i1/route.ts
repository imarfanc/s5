import { browseHandler, openHandler } from "./src/browse.ts";
import { docHandler } from "./src/docs.ts";
import { findHandler, fuzzyHandler } from "./src/find.ts";
import { healthHandler } from "./src/health.ts";
import { scanHandler, trashHandler } from "./src/junk.ts";
import { searchHandler } from "./src/search.ts";
import { sizesHandler } from "./src/sizes.ts";
import { treeHandler } from "./src/tree.ts";

const PREFIX = "/api/apps/files-i1";

/** Routes owned by the files-i1 toolkit. */
export async function handleFiles(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const { pathname } = url;
  if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) return null;

  if (pathname === `${PREFIX}/health` && request.method === "GET") return await healthHandler();
  if (pathname === `${PREFIX}/browse` && request.method === "GET") {
    return await browseHandler(request);
  }
  if (pathname === `${PREFIX}/search` && request.method === "POST") {
    return await searchHandler(request);
  }
  if (pathname === `${PREFIX}/scan` && request.method === "POST") return await scanHandler(request);
  if (pathname === `${PREFIX}/trash` && request.method === "POST") {
    return await trashHandler(request);
  }
  if (pathname === `${PREFIX}/sizes` && request.method === "POST") {
    return await sizesHandler(request);
  }
  if (pathname === `${PREFIX}/open` && request.method === "POST") return await openHandler(request);
  if (pathname === `${PREFIX}/find` && request.method === "POST") return await findHandler(request);
  if (pathname === `${PREFIX}/fuzzy` && request.method === "POST") {
    return await fuzzyHandler(request);
  }
  if (pathname === `${PREFIX}/tree` && request.method === "POST") return await treeHandler(request);
  if (pathname === `${PREFIX}/doc` && request.method === "GET") return await docHandler(request);

  return Response.json({ error: "Not found" }, { status: 404 });
}
