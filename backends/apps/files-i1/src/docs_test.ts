import { assertEquals, assertThrows } from "@std/assert";
import { PathError } from "./paths.ts";
import { validateCommandName } from "./docs.ts";

Deno.test("validateCommandName accepts ordinary command names", () => {
  assertEquals(validateCommandName("rg"), "rg");
  assertEquals(validateCommandName("git-status"), "git-status");
  assertEquals(validateCommandName("python3.12"), "python3.12");
});

Deno.test("validateCommandName rejects paths, spaces, and flags", () => {
  assertThrows(() => validateCommandName("../etc/passwd"), PathError);
  assertThrows(() => validateCommandName("ls foo"), PathError);
  assertThrows(() => validateCommandName("-k"), PathError);
  assertThrows(() => validateCommandName(""), PathError);
});
