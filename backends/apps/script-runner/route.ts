import { clientConfig } from "./src/config.ts";
import {
  discoverScripts,
  launchCommand,
  openInEditor,
  scriptDirectory,
  scriptFiles,
  type ScriptMeta,
} from "./src/scripts.ts";

const PREFIX = "/api/apps/script-runner";
const running = new Map<string, Deno.ChildProcess>();

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}

function crossOriginBlock(request: Request, url: URL): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    return new URL(origin).host === url.host ? null : json({ error: "Cross-origin request" }, 403);
  } catch {
    return json({ error: "Cross-origin request" }, 403);
  }
}

async function findScript(id: string): Promise<ScriptMeta | undefined> {
  return (await discoverScripts()).scripts.find((script) => script.id === id);
}

async function startRun(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as { scriptId?: unknown } | null;
  if (typeof body?.scriptId !== "string") return json({ error: "scriptId is required" }, 400);
  const meta = await findScript(body.scriptId);
  if (!meta) return json({ error: "Script not found" }, 404);
  const [command, ...args] = launchCommand(meta);
  let child: Deno.ChildProcess;
  try {
    child = new Deno.Command(command!, {
      args,
      cwd: scriptDirectory(meta),
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
      env: { ...Deno.env.toObject(), ...meta.env, FORCE_COLOR: "1", TERM: "xterm-256color" },
    }).spawn();
  } catch {
    return json({ error: `Could not launch ${command}` }, 500);
  }
  const runId = crypto.randomUUID();
  running.set(runId, child);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const send = (value: Uint8Array) => {
        if (open) {
          try {
            controller.enqueue(value);
          } catch {
            open = false;
          }
        }
      };
      const pump = async (source: ReadableStream<Uint8Array>) => {
        const reader = source.getReader();
        while (open) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) send(value);
        }
      };
      void (async () => {
        try {
          await Promise.all([pump(child.stdout), pump(child.stderr)]);
          const { code } = await child.status;
          // Plain text on purpose: the client styles this line itself, and an
          // escape code here would make the runner's annotation change how the
          // script's own output is interpreted.
          send(encoder.encode(`\n── exit ${code} ──\n`));
        } finally {
          running.delete(runId);
          open = false;
          try {
            controller.close();
          } catch { /* closed */ }
        }
      })();
    },
    cancel() {
      try {
        child.kill("SIGTERM");
      } catch { /* exited */ }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-run-id": runId,
      "access-control-expose-headers": "x-run-id",
    },
  });
}

export async function handleScriptRunner(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const { pathname } = url;
  if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) return null;

  const blocked = crossOriginBlock(request, url);
  if (blocked) return blocked;

  if (pathname === `${PREFIX}/catalog` && request.method === "GET") {
    return json({ ...(await discoverScripts()), config: clientConfig });
  }
  if (pathname === `${PREFIX}/runs` && request.method === "POST") {
    return await startRun(request);
  }
  // Script ids carry slashes, so the id is everything between the two markers.
  const files = pathname.match(/^\/api\/apps\/script-runner\/scripts\/(.+)\/files$/);
  if (files && request.method === "GET") {
    // Looked up in the catalog rather than joined onto a path, so a crafted id
    // cannot walk out of the scripts root.
    const meta = await findScript(decodeURIComponent(files[1]!));
    if (!meta) return json({ error: "Script not found" }, 404);
    return json({ files: await scriptFiles(meta) });
  }
  const open = pathname.match(/^\/api\/apps\/script-runner\/scripts\/(.+)\/open$/);
  if (open && request.method === "POST") {
    return await openFile(request, decodeURIComponent(open[1]!));
  }
  const match = pathname.match(/^\/api\/apps\/script-runner\/runs\/([\w-]+)$/);
  if (match && request.method === "DELETE") {
    const child = running.get(match[1]!);
    if (!child) return json({ stopped: false }, 404);
    try {
      child.kill("SIGTERM");
    } catch { /* exited */ }
    return json({ stopped: true });
  }
  return json({ error: "Not found" }, 404);
}

async function openFile(request: Request, id: string): Promise<Response> {
  const meta = await findScript(id);
  if (!meta) return json({ error: "Script not found" }, 404);
  const body = await request.json().catch(() => null) as { file?: unknown } | null;
  const name = typeof body?.file === "string" && body.file ? body.file : meta.entry;
  try {
    await openInEditor(meta, name);
    return json({ opened: name });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound && error.message === name) {
      return json({ error: `${name} is not part of this script` }, 400);
    }
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export function stopAll(): void {
  for (const child of running.values()) {
    try {
      child.kill("SIGTERM");
    } catch { /* exited */ }
  }
}
