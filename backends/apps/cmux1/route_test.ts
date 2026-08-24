import { assertEquals } from "@std/assert";
import { handleCmux1, trustedLocalRequest } from "./route.ts";

Deno.test("terminal app route ignores unrelated paths", async () => {
  assertEquals(await handleCmux1(new Request("http://localhost/api/apps")), null);
});

Deno.test("terminal app exposes its client config", async () => {
  const response = await handleCmux1(
    new Request("http://localhost/api/apps/cmux1/config"),
  );
  assertEquals(response?.status, 200);
  assertEquals(typeof (await response?.json()).host, "string");
});

Deno.test("terminal socket accepts only same-origin loopback requests", () => {
  assertEquals(
    trustedLocalRequest(new Request("http://localhost/api/apps/cmux1/terminal")),
    true,
  );
  assertEquals(
    trustedLocalRequest(
      new Request("http://localhost/api/apps/cmux1/terminal", {
        headers: { origin: "https://attacker.example" },
      }),
    ),
    false,
  );
  assertEquals(
    trustedLocalRequest(new Request("https://example.com/api/apps/cmux1/terminal")),
    false,
  );
});
