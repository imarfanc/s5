/**
 * Write `Apps/_manifest.json` — the app tree, precomputed for Val Town.
 *
 *     deno task manifest
 *     deno task manifest --check
 *
 * The folders remain authoritative. The server walks them locally, while
 * production reads this committed file to avoid a network request per folder
 * and `_app.yaml`. `--check` fails when the generated file is stale.
 */

import { buildDiscovery, MANIFEST_FILE } from "../../backends/routes/apps.ts";
import { config } from "./config.ts";
import { errorMessage, fail, info, muted, ok, warn } from "./style.ts";

const output = new URL(MANIFEST_FILE, `file://${config.root}`);
const checkOnly = Deno.args.includes("--check");

function serialise(manifest: unknown): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

async function readCommitted(): Promise<string | null> {
  try {
    return await Deno.readTextFile(output);
  } catch {
    return null;
  }
}

let manifest;
try {
  manifest = await buildDiscovery();
} catch (error) {
  fail(`could not read Apps/: ${errorMessage(error)}`);
}

// An empty gallery is valid after its apps have moved to another repository.

const next = serialise(manifest);
const committed = await readCommitted();
const summary = `${manifest.apps.length} app${manifest.apps.length === 1 ? "" : "s"} in ` +
  `${manifest.appspaces.length} appspace${manifest.appspaces.length === 1 ? "" : "s"} ` +
  muted(manifest.appspaces.map((appspace) => appspace.name).join(", "));

if (committed === next) {
  ok(`${MANIFEST_FILE} is up to date ${muted(`(${summary})`)}`);
} else if (checkOnly) {
  warn(committed === null ? `${MANIFEST_FILE} does not exist` : `${MANIFEST_FILE} is stale`);
  fail("run `deno task manifest`");
} else {
  await Deno.writeTextFile(output, next);
  info(summary);
  ok(
    `wrote ${MANIFEST_FILE} ${muted(`(${next.length} bytes)`)}` +
      (committed === null ? "" : muted(" — commit it with the app change")),
  );
}
