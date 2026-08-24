import { clientConfig } from "./config.ts";

const PUBLIC = new URL("../public/", import.meta.url);

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}

export async function handler(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/config" && request.method === "GET") return json(clientConfig);
  if (pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
  return await staticFile(pathname);
}

async function staticFile(pathname: string): Promise<Response> {
  const name = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!/^[\w./-]+$/.test(name) || name.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const body = await Deno.readFile(new URL(name, PUBLIC));
    const ext = name.slice(name.lastIndexOf("."));
    const types: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
    };
    return new Response(body, {
      headers: { "content-type": `${types[ext] ?? "application/octet-stream"}; charset=utf-8` },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

/** Release anything long-lived (child processes, timers) before the port closes. */
export function shutdown(): void {
}
