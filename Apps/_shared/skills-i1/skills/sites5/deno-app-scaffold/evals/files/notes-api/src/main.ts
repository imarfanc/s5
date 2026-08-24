import { notes } from "./notes.ts";

const PORT = 3000;

console.log("\x1b[32mnotes-api\x1b[0m listening on http://localhost:3000");

Deno.serve({ port: PORT }, (request) => {
  const { pathname } = new URL(request.url);
  if (pathname === "/notes") return Response.json(notes());
  return new Response("not found", { status: 404 });
});
