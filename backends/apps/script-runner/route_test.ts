import { assertEquals } from "@std/assert";
import { handleScriptRunner } from "./route.ts";

const PREFIX = "http://local/api/apps/script-runner";

Deno.test("catalog exposes scripts, diagnostics, and client configuration", async () => {
  const response = await handleScriptRunner(new Request(`${PREFIX}/catalog`));
  if (!response) throw new Error("route was not handled");
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(Array.isArray(body.scripts), true);
  assertEquals(Array.isArray(body.diagnostics), true);
  assertEquals(typeof body.config.columnWidths.scripts, "number");
  assertEquals(body.config.columnWidths.workspace, "auto");
});

Deno.test("script files list the entry first and the marker last", async () => {
  const response = await handleScriptRunner(new Request(`${PREFIX}/catalog`));
  if (!response) throw new Error("route was not handled");
  const catalog = await response.json();
  const script = catalog.scripts[0];
  if (!script) return;
  const filesResponse = await handleScriptRunner(
    new Request(`${PREFIX}/scripts/${script.id}/files`),
  );
  if (!filesResponse) throw new Error("route was not handled");
  assertEquals(filesResponse.status, 200);
  const { files } = await filesResponse.json();
  assertEquals(files[0].name, script.entry);
  assertEquals(files.at(-1).name, "_script.yaml");
  assertEquals(typeof files[0].text, "string");
});

Deno.test("files for an unknown script are 404", async () => {
  const response = await handleScriptRunner(new Request(`${PREFIX}/scripts/nope/there/files`));
  if (!response) throw new Error("route was not handled");
  assertEquals(response.status, 404);
});

Deno.test("opening a file the script does not own is refused", async () => {
  const catalogResponse = await handleScriptRunner(new Request(`${PREFIX}/catalog`));
  if (!catalogResponse) throw new Error("route was not handled");
  const catalog = await catalogResponse.json();
  const script = catalog.scripts[0];
  if (!script) return;
  const response = await handleScriptRunner(
    new Request(`${PREFIX}/scripts/${script.id}/open`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file: "../../../etc/hosts" }),
    }),
  );
  if (!response) throw new Error("route was not handled");
  assertEquals(response.status, 400);
});

Deno.test("opening a file for an unknown script is 404", async () => {
  const response = await handleScriptRunner(
    new Request(`${PREFIX}/scripts/nope/there/open`, { method: "POST" }),
  );
  if (!response) throw new Error("route was not handled");
  assertEquals(response.status, 404);
});

Deno.test("script runner route ignores unrelated paths", async () => {
  assertEquals(await handleScriptRunner(new Request("http://local/api/apps")), null);
});

Deno.test("run API validates its request", async () => {
  const response = await handleScriptRunner(
    new Request(`${PREFIX}/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  if (!response) throw new Error("route was not handled");
  assertEquals(response.status, 400);
});

Deno.test("script runner rejects cross-origin requests", async () => {
  const response = await handleScriptRunner(
    new Request(`${PREFIX}/catalog`, { headers: { origin: "https://example.com" } }),
  );
  if (!response) throw new Error("route was not handled");
  assertEquals(response.status, 403);
});
