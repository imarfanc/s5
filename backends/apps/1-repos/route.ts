import { clientConfig } from "./config.ts";
import { parsePromptStyle, spawnPty } from "./pty.ts";

const PREFIX = "/api/apps/1-repos";
const RESIZE = "\x1e";

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}

export function trustedLocalRequest(request: Request): boolean {
  const url = new URL(request.url);
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === url.origin;
  } catch {
    return false;
  }
}

function fontPath(): string | undefined {
  const home = Deno.env.get("HOME") ?? "";
  const names = [
    "MesloLGSNerdFontMono-Regular.ttf",
    "MesloLGSNerdFont-Regular.ttf",
    "HackNerdFontMono-Regular.ttf",
    "HackNerdFont-Regular.ttf",
  ];
  for (
    const directory of [`${home}/Library/Fonts`, `${home}/.local/share/fonts`, `${home}/.fonts`]
  ) {
    for (const name of names) {
      const path = `${directory}/${name}`;
      try {
        Deno.statSync(path);
        return path;
      } catch {
        // Keep looking through the supported local font locations.
      }
    }
  }
}

async function font(): Promise<Response> {
  const path = fontPath();
  if (!path) return new Response("Not found\n", { status: 404 });
  return new Response(await Deno.readFile(path), {
    headers: { "content-type": "font/ttf", "cache-control": "public, max-age=86400" },
  });
}

function terminal(request: Request): Response {
  if (!trustedLocalRequest(request)) return json({ error: "Local requests only" }, 403);
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return json({ error: "Expected a WebSocket upgrade" }, 426);
  }

  const url = new URL(request.url);
  const cols = Number(url.searchParams.get("cols"));
  const rows = Number(url.searchParams.get("rows"));
  const promptStyle = parsePromptStyle(url.searchParams.get("prompt"));
  const { socket, response } = Deno.upgradeWebSocket(request);
  let pty: ReturnType<typeof spawnPty> | undefined;

  socket.onopen = async () => {
    pty = spawnPty(cols, rows, promptStyle);
    const decoder = new TextDecoder();
    for await (const chunk of pty.output) {
      if (socket.readyState !== WebSocket.OPEN) break;
      socket.send(decoder.decode(chunk, { stream: true }));
    }
    socket.close();
  };
  socket.onmessage = (event) => {
    if (typeof event.data !== "string") return;
    if (event.data.startsWith(RESIZE)) {
      try {
        const size = JSON.parse(event.data.slice(1)) as { cols?: unknown; rows?: unknown };
        if (typeof size.cols === "number" && typeof size.rows === "number") {
          pty?.resize(size.cols, size.rows);
        }
      } catch {
        // A malformed control frame is ignored rather than written into the shell.
      }
      return;
    }
    pty?.write(event.data);
  };
  socket.onclose = () => void pty?.kill();
  socket.onerror = () => void pty?.kill();
  return response;
}

/** Routes owned by the 1-repos app; returns null for every unrelated request. */
export async function handleReposTerminal(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(`${PREFIX}/`)) return null;

  if (pathname === `${PREFIX}/config` && request.method === "GET") return json(clientConfig);
  if (pathname === `${PREFIX}/font` && request.method === "GET") return await font();
  if (pathname === `${PREFIX}/terminal` && request.method === "GET") return terminal(request);

  if (request.method !== "GET") {
    return new Response("Method not allowed\n", { status: 405, headers: { allow: "GET" } });
  }
  return json({ error: "Not found" }, 404);
}
