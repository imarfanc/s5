import { assertEquals, assertStringIncludes } from "@std/assert";
import { parsePromptStyle, sanitizeSize, spawnPty } from "./pty.ts";

async function readUntil(pty: ReturnType<typeof spawnPty>, needle: string): Promise<string> {
  const decoder = new TextDecoder();
  let seen = "";
  const reader = pty.output.getReader();
  const deadline = setTimeout(() => reader.cancel(), 5000);
  while (!seen.includes(needle)) {
    const { value, done } = await reader.read();
    if (done) break;
    seen += decoder.decode(value, { stream: true });
  }
  clearTimeout(deadline);
  reader.releaseLock();
  return seen;
}

Deno.test("1-repos PTY echoes shell output", async () => {
  const pty = spawnPty();
  pty.write("echo cmux1-ok\n");
  const seen = await readUntil(pty, "cmux1-ok");
  await pty.kill();
  assertStringIncludes(seen, "cmux1-ok");
});

Deno.test("1-repos PTY starts with the requested window size", async () => {
  const pty = spawnPty(80, 24);
  pty.write("stty size\n");
  const seen = await readUntil(pty, "24 80");
  await pty.kill();
  assertStringIncludes(seen, "24 80");
});

Deno.test("1-repos PTY advertises color even when its parent does not", async () => {
  const pty = spawnPty();
  pty.write('printf \'cmux-color:%s:%s\\n\' "$CLICOLOR" "$CLICOLOR_FORCE"\n');
  const seen = await readUntil(pty, "cmux-color:1:1");
  await pty.kill();
  assertStringIncludes(seen, "cmux-color:1:1");
});

Deno.test("1-repos Blocks prompt is opt-in for supported shells", async () => {
  const shell = (Deno.env.get("SHELL") ?? "/bin/bash").split("/").at(-1);
  if (shell !== "zsh" && shell !== "bash") return;
  const pty = spawnPty(80, 24, "blocks");
  const seen = await readUntil(pty, "");
  await pty.kill();
  assertStringIncludes(seen, "");
});

Deno.test("1-repos Arrow prompt is opt-in for supported shells", async () => {
  const shell = (Deno.env.get("SHELL") ?? "/bin/bash").split("/").at(-1);
  if (shell !== "zsh" && shell !== "bash") return;
  const pty = spawnPty(80, 24, "arrow");
  const seen = await readUntil(pty, "❯");
  await pty.kill();
  assertStringIncludes(seen, "❯");
});

Deno.test("1-repos Blocks prompt leaves the user's zsh environment alone", async () => {
  const shell = (Deno.env.get("SHELL") ?? "/bin/bash").split("/").at(-1);
  if (shell !== "zsh") return;
  // Blocks mode borrows ZDOTDIR to load its wrapper. By the time the shell is
  // ready it has to be back where the user's own config expects it, and any
  // history path derived while the wrapper was loading must be corrected.
  const pty = spawnPty(80, 24, "blocks");
  pty.write("printf 'cmux-zdotdir:%s\\n' \"${ZDOTDIR:-$HOME}\"\n");
  let seen = await readUntil(pty, "cmux-zdotdir:");
  pty.write("printf 'cmux-history:%s\\n' \"$HISTFILE\"\n");
  seen += await readUntil(pty, "cmux-history:");
  await pty.kill();
  const zdotdir = seen.split("cmux-zdotdir:").at(-1)?.split("\n")[0]?.trim();
  const history = seen.split("cmux-history:").at(-1)?.split("\n")[0]?.trim();
  assertEquals(zdotdir?.includes("/backends/apps/1-repos"), false);
  assertEquals(history?.includes("/backends/apps/1-repos"), false);
});

Deno.test("1-repos prompt query values map onto known styles", () => {
  assertEquals(parsePromptStyle(null), "native");
  assertEquals(parsePromptStyle("native"), "native");
  assertEquals(parsePromptStyle("blocks"), "blocks");
  assertEquals(parsePromptStyle("arrow"), "arrow");
  assertEquals(parsePromptStyle("nope"), "native");
});

Deno.test("1-repos PTY sanitizes invalid dimensions", () => {
  assertEquals(sanitizeSize(0, 0), { cols: 80, rows: 24 });
  assertEquals(sanitizeSize(Number.NaN, Number.NaN), { cols: 80, rows: 24 });
  assertEquals(sanitizeSize(120, 40), { cols: 120, rows: 40 });
});
