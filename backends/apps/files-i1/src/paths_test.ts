import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { join } from "node:path";
import { expandHome, homeDir, isUnder, PathError, resolvePath } from "./paths.ts";

Deno.test("expandHome rewrites ~ and $HOME", () => {
  const home = homeDir();
  assertEquals(expandHome("~"), home);
  assertEquals(expandHome("~/Documents"), join(home, "Documents"));
  assertEquals(expandHome("$HOME/src"), `${home}/src`);
});

Deno.test("isUnder treats descendants as inside, siblings as outside", () => {
  const home = homeDir();
  assertEquals(isUnder(home, home), true);
  assertEquals(isUnder(home, join(home, "src")), true);
  assertEquals(isUnder(join(home, "src"), home), false);
});

Deno.test("resolvePath refuses escapes outside $HOME", async () => {
  await assertRejects(
    () => resolvePath("/tmp"),
    PathError,
    "outside $HOME",
  );
  await assertRejects(
    () => resolvePath("~/../../tmp"),
    PathError,
  );
});

Deno.test("resolvePath refuses the denylist", async () => {
  await assertRejects(() => resolvePath("~/.ssh"), PathError, "blocked");
  await assertRejects(() => resolvePath("~/Library"), PathError, "blocked");
  await assertRejects(() => resolvePath("~/.gnupg"), PathError, "blocked");
  await assertRejects(() => resolvePath("~/.Trash"), PathError, "blocked");
  await assertRejects(() => resolvePath("~/Applications"), PathError, "blocked");
});

Deno.test("resolvePath allows Xcode caches only with allowXcode", async () => {
  const derived = "~/Library/Developer/Xcode/DerivedData";
  await assertRejects(() => resolvePath(derived), PathError, "blocked");
  const real = await resolvePath(derived, { allowXcode: true });
  assertStringIncludes(real, "DerivedData");
});

Deno.test("resolvePath refuses to trash $HOME", async () => {
  await assertRejects(
    () => resolvePath("~", { forDelete: true }),
    PathError,
    "refusing to trash $HOME",
  );
});
