import { clientConfig } from "./src/config.ts";
import { installedAgents, installSkill, removeSkill } from "./src/install.ts";
import { openDirectory } from "./src/open.ts";
import { type Agent, installDirectory, loadSettings, resolveTargetPath } from "./src/settings.ts";
import { listSkills, readSkillMarkdown, skillLeafName } from "./src/skills.ts";

const PREFIX = "/api/apps/skills-i1";

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}

/**
 * Localhost is not private: any page in the browser can reach this API, and a
 * cross-site one can POST to it with `mode: "no-cors"`. Refuse any request
 * that names another origin.
 */
function crossOriginBlock(request: Request, url: URL): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    return new URL(origin).host === url.host ? null : json({ error: "Cross-origin request" }, 403);
  } catch {
    return json({ error: "Cross-origin request" }, 403);
  }
}

/** Parse a POST body, insisting on a JSON content-type — `no-cors` cannot send one. */
async function readJsonBody(request: Request): Promise<Record<string, unknown> | Response> {
  const [rawType] = (request.headers.get("content-type") ?? "").split(";");
  const type = (rawType ?? "").trim().toLowerCase();
  if (type !== "application/json") {
    return json({ ok: false, message: "Expected content-type: application/json" }, 415);
  }
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, message: "Expected a JSON body" }, 400);
  }
}

export async function handleSkillsHub(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const { pathname } = url;
  if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) return null;
  const route = pathname.slice(PREFIX.length) || "/";
  if (route.startsWith("/")) {
    const blocked = crossOriginBlock(request, url);
    if (blocked) return blocked;
    if (request.method === "GET") {
      if (route === "/config") return json(clientConfig);
      if (route === "/settings") return json(await loadSettings());
      if (route === "/skills") return await skillsResponse(url);
      if (route === "/skill") return await skillResponse(url);
    } else if (request.method === "POST") {
      if (route === "/install") return await installResponse(request);
      if (route === "/uninstall") return await uninstallResponse(request);
      if (route === "/open") return await openResponse(request);
    }
    return json({ error: "Not found" }, 404);
  }
  return json({ error: "Not found" }, 404);
}

/**
 * Resolve the target the browser asked for: an explicit `path` wins, otherwise
 * the named target, otherwise the configured default.
 */
async function resolveRequestedTarget(
  targetId: string | null,
  customPath: string | null,
): Promise<{ path: string; resolved: string }> {
  const settings = await loadSettings();
  if (customPath && customPath.trim() !== "") {
    return { path: customPath, resolved: resolveTargetPath(customPath, settings.repoRoot) };
  }
  const target = settings.targets.find((candidate) => candidate.id === targetId) ??
    settings.targets.find((candidate) => candidate.id === settings.defaultTargetId) ??
    settings.targets[0];
  const path = target?.path ?? ".";
  return { path, resolved: resolveTargetPath(path, settings.repoRoot) };
}

async function skillsResponse(url: URL): Promise<Response> {
  const settings = await loadSettings();
  const target = await resolveRequestedTarget(
    url.searchParams.get("target"),
    url.searchParams.get("path"),
  );
  const skills = await listSkills();
  const withState = await Promise.all(skills.map(async (skill) => ({
    ...skill,
    installed: await installedAgents(skill.id, settings.agents, target.resolved),
  })));
  return json({ skills: withState, targetPath: target.resolved });
}

/** One skill's SKILL.md body — what the preview pane renders. */
async function skillResponse(url: URL): Promise<Response> {
  const markdown = await readSkillMarkdown(url.searchParams.get("name") ?? "");
  if (markdown === null) return json({ error: "No such skill" }, 404);
  return json({ markdown });
}

async function installResponse(request: Request): Promise<Response> {
  const parsed = await readJsonBody(request);
  if (parsed instanceof Response) return parsed;
  const settings = await loadSettings();
  const agent = settings.agents.find((candidate) => candidate.id === parsed.agent);
  if (!agent) return json({ ok: false, message: `Unknown agent: ${parsed.agent}` }, 400);

  const target = await resolveRequestedTarget(
    typeof parsed.target === "string" ? parsed.target : null,
    typeof parsed.path === "string" ? parsed.path : null,
  );
  const result = await installSkill(
    String(parsed.skill ?? ""),
    agent,
    target.resolved,
    parsed.overwrite === true,
  );
  return json(result, result.ok || result.status === "exists" ? 200 : 400);
}

async function uninstallResponse(request: Request): Promise<Response> {
  const parsed = await readJsonBody(request);
  if (parsed instanceof Response) return parsed;
  const settings = await loadSettings();
  const agent = settings.agents.find((candidate) => candidate.id === parsed.agent);
  if (!agent) return json({ ok: false, message: `Unknown agent: ${parsed.agent}` }, 400);

  const target = await resolveRequestedTarget(
    typeof parsed.target === "string" ? parsed.target : null,
    typeof parsed.path === "string" ? parsed.path : null,
  );
  const result = await removeSkill(String(parsed.skill ?? ""), agent, target.resolved);
  return json(result, result.ok || result.status === "absent" ? 200 : 400);
}

/**
 * Open a directory in a local app. Which directory depends on how specific the
 * request is: a skill's own folder, an agent's skills folder, or the target root.
 */
async function openResponse(request: Request): Promise<Response> {
  const parsed = await readJsonBody(request);
  if (parsed instanceof Response) return parsed;
  const settings = await loadSettings();
  const opener = settings.openers.find((candidate) => candidate.id === parsed.opener);
  if (!opener) return json({ ok: false, message: `Unknown opener: ${parsed.opener}` }, 400);

  const target = await resolveRequestedTarget(
    typeof parsed.target === "string" ? parsed.target : null,
    typeof parsed.path === "string" ? parsed.path : null,
  );
  const agent = settings.agents.find((candidate) => candidate.id === parsed.agent);
  const result = await openDirectory(opener, directoryFor(target.resolved, agent, parsed.skill));
  return json(result, result.ok ? 200 : 400);
}

function directoryFor(targetPath: string, agent: Agent | undefined, skill: unknown): string {
  if (!agent) return resolveTargetPath(targetPath);
  const skillName = typeof skill === "string" && skill !== "" ? skillLeafName(skill) : "";
  const directory = installDirectory(targetPath, agent, skillName);
  return skillName === "" ? directory.replace(/\/$/, "") : directory;
}
