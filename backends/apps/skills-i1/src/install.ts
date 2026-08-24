import { dirname, join } from "node:path";
import { copy, ensureDir, exists } from "./fs.ts";
import { type Agent, installDirectory } from "./settings.ts";
import { isValidSkillId, skillDirectory, skillLeafName } from "./skills.ts";

export interface SkillResult {
  ok: boolean;
  /** The directory the skill now lives in (or would have). */
  path: string;
  /** `installed`, `replaced`, `exists` (needs overwrite), `removed`, `absent`, or `error`. */
  status: "installed" | "replaced" | "exists" | "removed" | "absent" | "error";
  message: string;
}

/**
 * Copy `skills/<id>/` into `<target>/<agent.dir>/<agent.skillsSubdir>/<leaf>/`,
 * where `id` may name a group (`sites5/sites5-app-parity`) and `leaf` is its
 * last segment. Groups organise the library; agents read a flat skills
 * directory, so the group is deliberately dropped on the way out.
 *
 * Existing installs are left alone unless `overwrite` is set, so a stray click
 * can never quietly discard a skill someone edited in place.
 */
export async function installSkill(
  skill: string,
  agent: Agent,
  targetPath: string,
  overwrite = false,
): Promise<SkillResult> {
  const source = skillDirectory(skill);
  if (!source) {
    return { ok: false, path: "", status: "error", message: `Invalid skill name: ${skill}` };
  }
  const destination = installDirectory(targetPath, agent, skillLeafName(skill));

  if (!await exists(join(source, "SKILL.md"))) {
    return { ok: false, path: destination, status: "error", message: `No such skill: ${skill}` };
  }
  const already = await exists(destination);
  if (already && !overwrite) {
    return {
      ok: false,
      path: destination,
      status: "exists",
      message: "Already installed — use Replace to overwrite.",
    };
  }
  try {
    await ensureDir(dirname(destination));
    if (already) await Deno.remove(destination, { recursive: true });
    await copy(source, destination);
    return {
      ok: true,
      path: destination,
      status: already ? "replaced" : "installed",
      message: already ? `Replaced in ${agent.label}` : `Installed to ${agent.label}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, path: destination, status: "error", message };
  }
}

/**
 * Remove `<target>/<agent.dir>/<agent.skillsSubdir>/<leaf>/` — exactly the
 * directory {@linkcode installSkill} writes, and nothing else. An id that
 * could escape the library is rejected outright.
 */
export async function removeSkill(
  skill: string,
  agent: Agent,
  targetPath: string,
): Promise<SkillResult> {
  if (!isValidSkillId(skill)) {
    return { ok: false, path: "", status: "error", message: `Invalid skill name: ${skill}` };
  }
  const destination = installDirectory(targetPath, agent, skillLeafName(skill));
  if (!await exists(destination)) {
    return { ok: false, path: destination, status: "absent", message: "Not installed here." };
  }
  try {
    await Deno.remove(destination, { recursive: true });
    return {
      ok: true,
      path: destination,
      status: "removed",
      message: `Removed from ${agent.label}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, path: destination, status: "error", message };
  }
}

/**
 * Which agents in this target already have this skill — drives the UI badges.
 * Checked by leaf name, matching where {@linkcode installSkill} writes.
 */
export async function installedAgents(
  skill: string,
  agents: Agent[],
  targetPath: string,
): Promise<string[]> {
  const found: string[] = [];
  for (const agent of agents) {
    if (await exists(installDirectory(targetPath, agent, skillLeafName(skill)))) {
      found.push(agent.id);
    }
  }
  return found;
}
