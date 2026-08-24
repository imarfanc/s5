import { assertEquals } from "@std/assert";
import { handler } from "../server.ts";

Deno.test("config endpoint returns the client settings", async () => {
  const response = await handler(new Request("http://local/api/config"));
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(typeof body.title, "string");
});

Deno.test("unknown API routes are 404 JSON", async () => {
  const response = await handler(new Request("http://local/api/nope"));
  assertEquals(response.status, 404);
});
