import { assertEquals } from "@std/assert";
import { fdArgs } from "./find.ts";

const BASE = {
  root: "/tmp",
  pattern: "foo",
  kind: "any" as const,
  ext: "",
  hidden: false,
  depth: 0,
  changedWithin: "",
};

Deno.test("fdArgs always sets absolute-path and never color", () => {
  const args = fdArgs(BASE, "/Users/me/src");
  assertEquals(args.slice(0, 2), ["--absolute-path", "--color=never"]);
  assertEquals(args.slice(-2), ["foo", "/Users/me/src"]);
});

Deno.test("fdArgs maps kind, extension, hidden, depth, and changed-within", () => {
  const args = fdArgs({
    ...BASE,
    kind: "file",
    ext: "ts",
    hidden: true,
    depth: 3,
    changedWithin: "7d",
  }, "/r");
  assertEquals(args.includes("--type"), true);
  assertEquals(args.includes("f"), true);
  assertEquals(args.includes("--extension"), true);
  assertEquals(args.includes("ts"), true);
  assertEquals(args.includes("--hidden"), true);
  assertEquals(args.includes("--max-depth"), true);
  assertEquals(args.includes("3"), true);
  assertEquals(args.includes("--changed-within"), true);
  assertEquals(args.includes("7d"), true);
});
