import { assertEquals } from "@std/assert";
import { notes } from "./notes.ts";

Deno.test("notes are returned", () => {
  assertEquals(notes().length, 2);
});
