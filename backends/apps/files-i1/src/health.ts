import { commandExists } from "../shared/process.ts";

export const HOST_TOOLS = ["rg", "fd", "fzf", "tree", "tldr", "trash", "man"] as const;

export type HostTool = typeof HOST_TOOLS[number];

export const BREW: Record<HostTool, string> = {
  rg: "brew install ripgrep",
  fd: "brew install fd",
  fzf: "brew install fzf",
  tree: "brew install tree",
  tldr: "brew install tldr",
  trash: "brew install trash",
  man: "man is part of macOS",
};

export async function healthHandler(): Promise<Response> {
  const tools: Record<string, { present: boolean; brew: string }> = {};
  for (const name of HOST_TOOLS) {
    tools[name] = { present: await commandExists(name), brew: BREW[name] };
  }
  return Response.json({ tools });
}
