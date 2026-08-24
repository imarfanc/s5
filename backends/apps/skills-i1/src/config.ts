/** Settings the app hands to the browser. Everything here is public. */
export const clientConfig = {
  title: "Skills Hub",
  favicon: "/apps/26.8.21-repos/skills-i1/favicon.svg",
};

export const config = {
  ...clientConfig,
  /** Where the skill library lives. */
  skillsRoot: new URL("../../../../Apps/_shared/skills-i1/skills/", import.meta.url),
  /** User-editable defaults: targets, agent directories, initial selection. */
  settingsFile: new URL("../skills.config.json", import.meta.url),
  /** Fallback when skills.config.json omits repoRoot. */
  repoRoot: new URL("../../../../", import.meta.url),
};
