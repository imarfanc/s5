import { assertEquals } from "@std/assert";
import { homeRelativePath } from "./files.ts";

Deno.test("homeRelativePath uses ~ when the path sits under $HOME", () => {
  assertEquals(
    homeRelativePath("/Users/arfan3/developer/gh/sites5-local", "/Users/arfan3"),
    "~/developer/gh/sites5-local",
  );
  assertEquals(homeRelativePath("/Users/arfan3/", "/Users/arfan3"), "~");
  assertEquals(
    homeRelativePath("/opt/sites5-local", "/Users/arfan3"),
    "/opt/sites5-local",
  );
  assertEquals(
    homeRelativePath("/Users/arfan3/developer/gh/sites5-local", undefined),
    "/Users/arfan3/developer/gh/sites5-local",
  );
});
