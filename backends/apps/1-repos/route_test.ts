import { assertEquals } from "@std/assert";
import { handleReposTerminal, trustedLocalRequest } from "./route.ts";

Deno.test("terminal app route ignores unrelated paths", async () => {
  assertEquals(await handleReposTerminal(new Request("http://localhost/api/apps")), null);
});

Deno.test("terminal app exposes its client config", async () => {
  const response = await handleReposTerminal(
    new Request("http://localhost/api/apps/1-repos/config"),
  );
  assertEquals(response?.status, 200);
  assertEquals(typeof (await response?.json()).host, "string");
});

Deno.test("terminal socket accepts only same-origin loopback requests", () => {
  assertEquals(
    trustedLocalRequest(new Request("http://localhost/api/apps/1-repos/terminal")),
    true,
  );
  assertEquals(
    trustedLocalRequest(
      new Request("http://localhost/api/apps/1-repos/terminal", {
        headers: { origin: "https://attacker.example" },
      }),
    ),
    false,
  );
  assertEquals(
    trustedLocalRequest(new Request("https://example.com/api/apps/1-repos/terminal")),
    false,
  );
});
