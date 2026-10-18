/**
 * The request router.
 *
 * Auth runs first: the login routes are always reachable, and every other
 * request needs a valid session cookie. After that, handlers are tried in
 * order and the first one to claim the request wins; a handler returns null to
 * pass. Adding a backend means adding one line here.
 */

import {
  authenticationRequired,
  authenticationUnavailable,
  handleAuth,
  isAuthenticated,
} from "../auth.ts";
import { handleApps } from "./apps.ts";
import { handleData } from "./data.ts";
import { handleDb } from "./db.ts";
import { handleProjectFiles } from "./project-files.ts";
import { handleSqliteInspect } from "./sqlite-inspect.ts";
import { handleStatic } from "./static.ts";

const HANDLERS = [
  handleApps,
  handleData,
  handleDb,
  handleSqliteInspect,
  handleProjectFiles,
  handleStatic,
];

export async function handleRequest(request: Request): Promise<Response> {
  const authResponse = await handleAuth(request);
  if (authResponse) return authResponse;

  if (!Deno.env.get("T1_PASSWORD")) return authenticationUnavailable();
  if (!(await isAuthenticated(request))) return authenticationRequired(request);

  for (const handler of HANDLERS) {
    const response = await handler(request);
    if (response) return response;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed\n", {
      status: 405,
      headers: { allow: "GET, HEAD" },
    });
  }
  return new Response("Not found\n", { status: 404 });
}
