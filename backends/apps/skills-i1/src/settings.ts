import { isAbsolute, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.ts";

/** A place skills can be installed into: a home directory, a repo, anything. */
export interface Target {
  id: string;
  label: string;
  /** `~`, `.`, or an absolute path. Resolved by {@linkcode resolveTargetPath}. */
  path: string;
}

/** An agent convention — the directory an agent reads its skills from. */
export interface Agent {
  id: string;
  label: string;
  /** Directory created inside the target, e.g. `.claude`. */
  dir: string;
  /** Directory inside `dir` that holds one folder per skill. */
  skillsSubdir: string;
}

/**
 * An external app the UI can hand a directory to. `command` is run as-is with
 * `{path}` replaced by the resolved directory — adding an editor is a config
 * edit, not a code change.
 */
export interface Opener {
  id: string;
  label: string;
  /** Iconify name, e.g. `mdi:apple-finder`. */
  icon: string;
  command: string[];
}

export interface Settings {
  defaultTargetId: string;
  defaultAgentId: string;
  /** Where `.` (This repo) expands. `~`, `$HOME`, or an absolute path. */
  repoRoot: string;
  targets: Target[];
  agents: Agent[];
  openers: Opener[];
  /** Set when skills.config.json could not be read or parsed; null when it loaded. */
  configError: string | null;
}

function compiledRepoRoot(): string {
  return normalize(fileURLToPath(config.repoRoot));
}

const FALLBACK: Settings = {
  configError: null,
  defaultTargetId: "global",
  defaultAgentId: "claude",
  repoRoot: compiledRepoRoot(),
  targets: [
    { id: "global", label: "Global (home)", path: "~" },
    { id: "repo", label: "This repo", path: "." },
  ],
  agents: [
    { id: "claude", label: ".claude", dir: ".claude", skillsSubdir: "skills" },
    { id: "agents", label: ".agents", dir: ".agents", skillsSubdir: "skills" },
    { id: "cursor", label: ".cursor", dir: ".cursor", skillsSubdir: "skills" },
  ],
  openers: [
    { id: "finder", label: "Finder", icon: "mdi:apple-finder", command: ["open", "{path}"] },
    { id: "cursor", label: "Cursor", icon: "simple-icons:cursor", command: ["cursor", "{path}"] },
    {
      id: "zed",
      label: "Zed",
      icon: "simple-icons:zedindustries",
      command: ["/Applications/Zed Preview.app/Contents/MacOS/cli", "{path}"],
    },
  ],
};

/**
 * Read `skills.config.json` on every call, so editing the file takes effect
 * without restarting the server. A missing or malformed file falls back to the
 * built-in defaults rather than taking the app down — and says why in
 * `configError`, so the UI can surface it instead of failing silently.
 */
export async function loadSettings(): Promise<Settings> {
  let text: string;
  try {
    text = await Deno.readTextFile(config.settingsFile);
  } catch {
    return { ...FALLBACK, configError: "skills.config.json not found — using built-in defaults." };
  }
  let raw: Partial<Settings>;
  try {
    raw = JSON.parse(text) as Partial<Settings>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ...FALLBACK, configError: `skills.config.json is not valid JSON — ${detail}` };
  }
  return {
    configError: null,
    defaultTargetId: raw.defaultTargetId ?? FALLBACK.defaultTargetId,
    defaultAgentId: raw.defaultAgentId ?? FALLBACK.defaultAgentId,
    repoRoot: typeof raw.repoRoot === "string" && raw.repoRoot.trim() !== ""
      ? raw.repoRoot.trim()
      : FALLBACK.repoRoot,
    targets: raw.targets?.length ? raw.targets : FALLBACK.targets,
    agents: raw.agents?.length ? raw.agents : FALLBACK.agents,
    openers: raw.openers?.length ? raw.openers : FALLBACK.openers,
  };
}

export function homeDirectory(): string {
  return Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? "/";
}

function expandHomePrefix(path: string): string | null {
  if (path === "~" || path === "$HOME") return homeDirectory();
  if (path.startsWith("~/")) return join(homeDirectory(), path.slice(2));
  if (path.startsWith("$HOME/")) return join(homeDirectory(), path.slice(6));
  return null;
}

function expandRepoRoot(repoRoot: string): string {
  const trimmed = repoRoot.trim();
  const fromHome = expandHomePrefix(trimmed);
  if (fromHome) return fromHome;
  if (trimmed === "" || trimmed === ".") return compiledRepoRoot();
  if (isAbsolute(trimmed)) return normalize(trimmed);
  return join(compiledRepoRoot(), trimmed);
}

/** Expand `~`, `$HOME`, `.`, and `~/...` into an absolute path. */
export function resolveTargetPath(path: string, repoRoot = compiledRepoRoot()): string {
  const trimmed = path.trim();
  const root = expandRepoRoot(repoRoot);
  const fromHome = expandHomePrefix(trimmed);
  if (fromHome) return fromHome;
  if (trimmed === "" || trimmed === ".") return root;
  if (isAbsolute(trimmed)) return normalize(trimmed);
  return join(root, trimmed);
}

/** The directory a skill of this name would occupy for one agent in one target. */
export function installDirectory(
  base: string,
  agent: Agent,
  skill: string,
  repoRoot?: string,
): string {
  return join(resolveTargetPath(base, repoRoot), agent.dir, agent.skillsSubdir, skill);
}
