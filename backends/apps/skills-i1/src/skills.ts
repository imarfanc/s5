import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.ts";

export interface Skill {
  /**
   * Library path relative to `skills/`, slash separated — `repo-tour` at the
   * root, `sites5/sites5-app-parity` inside a group. This is the identifier the
   * browser sends back for install, remove, and preview.
   */
  id: string;
  /**
   * Leaf directory name, and the folder name the skill installs as. Agents read
   * a flat skills directory, so the group is a library-side idea only.
   */
  name: string;
  /** Slash-separated folders above the skill, or "" at the library root. */
  group: string;
  /** `name:` from the SKILL.md front matter, when present. */
  title: string;
  description: string;
  fileCount: number;
  /** Front-matter and library problems worth showing in the UI. */
  warnings: string[];
}

const SEGMENT_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

/** Agents truncate beyond this; the UI flags longer descriptions. */
const DESCRIPTION_LIMIT = 1024;

/**
 * How deep to look for skills. Groups exist to keep the library readable, not
 * to build a tree, so one level of nesting is plenty and the bound keeps a
 * stray `node_modules` from turning listing into a full-disk walk.
 */
const MAX_DEPTH = 3;

export function skillsRootPath(): string {
  return fileURLToPath(config.skillsRoot);
}

/**
 * Reject anything that could escape the skills directory. Ids may contain `/`
 * now that skills can be grouped, so validate each segment on its own — that
 * rules out `..`, absolute paths, and empty segments in one pass.
 */
export function isValidSkillId(id: string): boolean {
  const segments = id.split("/");
  if (segments.length === 0 || segments.length > MAX_DEPTH) return false;
  return segments.every((segment) => SEGMENT_PATTERN.test(segment) && segment !== "..");
}

/** The install-time folder name for an id: the last segment. */
export function skillLeafName(id: string): string {
  return id.split("/").pop() ?? id;
}

/**
 * Parse the leading `---` block of a SKILL.md. Deliberately minimal: `key: value`
 * pairs only, which is all the skill format needs, and one less dependency.
 */
export function parseFrontMatter(text: string): Record<string, string> {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match?.[1]) return {};
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (pair?.[1]) fields[pair[1]] = (pair[2] ?? "").replace(/^["']|["']$/g, "").trim();
  }
  return fields;
}

/** Problems in the front matter that the list should surface. */
function frontMatterWarnings(fields: Record<string, string>): string[] {
  const description = fields.description ?? "";
  if (description === "") return ["no description — agents match skills on it"];
  if (description.length > DESCRIPTION_LIMIT) {
    return [`description is ${description.length} characters — trim it under ${DESCRIPTION_LIMIT}`];
  }
  return [];
}

/** Drop the leading front-matter block, leaving the readable body. */
export function stripFrontMatter(text: string): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trimStart();
}

/** Resolve a library id to its directory, or null when the id is not safe. */
export function skillDirectory(id: string): string | null {
  if (!isValidSkillId(id)) return null;
  return join(skillsRootPath(), ...id.split("/"));
}

/** The SKILL.md body for one skill, or null when there is no such skill. */
export async function readSkillMarkdown(id: string): Promise<string | null> {
  const directory = skillDirectory(id);
  if (!directory) return null;
  try {
    return stripFrontMatter(await Deno.readTextFile(join(directory, "SKILL.md")));
  } catch {
    return null;
  }
}

async function countFiles(directory: string): Promise<number> {
  let total = 0;
  for await (const entry of Deno.readDir(directory)) {
    if (entry.isDirectory) total += await countFiles(join(directory, entry.name));
    else total += 1;
  }
  return total;
}

async function readSkill(directory: string, id: string): Promise<Skill | null> {
  let text: string;
  try {
    text = await Deno.readTextFile(join(directory, "SKILL.md"));
  } catch {
    return null;
  }
  const fields = parseFrontMatter(text);
  const segments = id.split("/");
  return {
    id,
    name: segments[segments.length - 1] ?? id,
    group: segments.slice(0, -1).join("/"),
    title: fields.name ?? segments[segments.length - 1] ?? id,
    description: fields.description ?? "",
    fileCount: await countFiles(directory),
    warnings: frontMatterWarnings(fields),
  };
}

/**
 * Walk the library. A directory holding a SKILL.md is a skill and is not
 * descended into — its own subfolders are `references/`, `assets/` and the
 * like, not nested skills. A directory without one is a group, so recurse.
 */
async function walk(directory: string, prefix: string, depth: number): Promise<Skill[]> {
  if (depth > MAX_DEPTH) return [];
  let entries: Deno.DirEntry[];
  try {
    entries = await Array.fromAsync(Deno.readDir(directory));
  } catch {
    return [];
  }
  const found: Skill[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory || !SEGMENT_PATTERN.test(entry.name)) continue;
    const child = join(directory, entry.name);
    const id = prefix ? `${prefix}/${entry.name}` : entry.name;
    const skill = await readSkill(child, id);
    if (skill) found.push(skill);
    else found.push(...await walk(child, id, depth + 1));
  }
  return found;
}

/**
 * Every skill in the library, at the root or inside a group, sorted with
 * ungrouped skills first and then by group. Two skills in different groups can
 * share a leaf name, and since that name is what they install as, they would
 * fight over the same destination — so flag both rather than let one silently
 * replace the other.
 */
export async function listSkills(): Promise<Skill[]> {
  const skills = await walk(skillsRootPath(), "", 1);
  const counts = new Map<string, number>();
  for (const skill of skills) counts.set(skill.name, (counts.get(skill.name) ?? 0) + 1);
  for (const skill of skills) {
    if ((counts.get(skill.name) ?? 0) > 1) {
      skill.warnings = [
        ...skill.warnings,
        `another skill installs as "${skill.name}" too — rename one`,
      ];
    }
  }
  return skills.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
}
