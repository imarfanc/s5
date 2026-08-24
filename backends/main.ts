/**
 * sites5
 *
 *   Apps/                one folder per app, each with an `_app.yaml`
 *   backends/            the backend code for the apps
 *   frontends/           the frontends code for the apps
 *   shared/              tokens, components, and helpers used by every page
 */
import { handleRequest } from "./routes/router.ts";

/** Val Town calls this default export; `deno task dev` serves it locally. */
export default handleRequest;

if (import.meta.main) {
  Deno.serve({ port: Number(Deno.env.get("PORT") ?? "8891") }, handleRequest);
}
