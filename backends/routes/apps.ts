/**
 * App discovery.
 *
 * Walks `Apps/` for `_app.yaml` markers, folds them into the appspace/section
 * tree described by `Apps/sections-metadata.yaml`, and serves the whole thing as
 * one JSON document. The same walk generates the committed production manifest;
 * locally the folders remain authoritative.
 */

import { list, listOfMaps, scalars } from "../../shared/app-yaml.ts";
import {
  listPaths,
  type LocalCheckout,
  localCheckout,
  ON_VAL_TOWN,
  readTextFile,
} from "../files.ts";

const APPS_ROOT = "Apps/";
const METADATA_FILE = `${APPS_ROOT}sections-metadata.yaml`;
const MARKER = "_app.yaml";
/** The generated production tree, committed beside the folders it describes. */
export const MANIFEST_FILE = `${APPS_ROOT}_manifest.json`;

export interface App {
  id: string;
  name: string;
  sort_name: string;
  description: string;
  updated: string;
  icon: string;
  color: string;
  appspace: string;
  sections: string[];
  tags: string[];
  path: string;
  url: string;
  /**
   * Namespace for this app's `/api/data/` storage. Independent of the folder
   * path on purpose: an app's `id` is derived from the path and so breaks when
   * a folder is renamed, and saved data should not. Falls back to `id` when
   * `_app.yaml` leaves it out, which reintroduces exactly that fragility.
   */
  store: string;
  /**
   * The generation of this app's database, as `v1`, `v2`, … — or `""` for an
   * app with no database, which is most of them.
   *
   * Its tables live in the one database every app shares, named
   * `<store>_<generation>_<table>`, so the generation is both a
   * namespace and the migration mechanism: SQLite cannot `ALTER` most schema
   * changes into place, so a breaking change bumps this and copies the old rows
   * across in `migrate.sql`. The schema itself is in the app's `schema.sql`,
   * not here — `routes/db.ts` reads it on first use.
   */
  db: string;
  /**
   * Extra entry points inside the app folder, as bare filenames. The sidebar
   * renders one row per entry under the app, each opening at
   * `/apps/<path>/<file>` exactly as `entry` does. Nothing here is checked
   * against the folder — a filename with no file behind it produces a row
   * whose preview fails to load.
   */
  children: string[];
}

export interface Section {
  name: string;
  sort_name: string;
  icon: string;
  color: string;
  sections: Section[];
}

export interface Appspace {
  name: string;
  icon: string;
  color: string;
  sections: Section[];
}

/** Discovery minus the machine-specific local checkout. */
export type Manifest = Omit<Discovery, "checkout">;

export interface Discovery {
  schema_version: number;
  /**
   * The local checkout, so the shell can build Keyboard Maestro links without
   * hardcoding a path. Null on Val Town, where there is nothing to open.
   */
  checkout: LocalCheckout | null;
  appspaces: Appspace[];
  apps: App[];
}

/** Discovery is stable between edits, so the walk runs once per process. */
let cached: Discovery | null = null;

/**
 * Every `_app.yaml` under `Apps/`, as paths relative to `Apps/`.
 *
 * Folders beginning with `_` or `.` are skipped, which is what keeps
 * `Apps/_templates/` from registering itself as an app.
 */
async function findMarkers(): Promise<string[]> {
  const paths = await listPaths();
  return paths
    .filter((path) => path.startsWith(APPS_ROOT) && path.endsWith(`/${MARKER}`))
    .map((path) => path.slice(APPS_ROOT.length))
    .filter((path) =>
      !path.split("/").slice(0, -1).some((segment) =>
        segment.startsWith("_") || segment.startsWith(".")
      )
    )
    .sort((a, b) => a.localeCompare(b));
}

function idFromPath(path: string): string {
  return path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

async function readMetadataFile(): Promise<string> {
  try {
    return await readTextFile(METADATA_FILE);
  } catch {
    return "";
  }
}

function readSectionMetadata(yaml: string): Map<string, Section> {
  const metadata = new Map<string, Section>();
  for (const record of listOfMaps(yaml, "sections")) {
    const name = record.name;
    if (!name) continue;
    metadata.set(name, {
      name,
      sort_name: record.sort_name || name,
      icon: record.icon ?? "",
      color: record.color ?? "",
      sections: [],
    });
  }
  return metadata;
}

/**
 * Per-appspace presentation from the `appspaces:` list in
 * `sections-metadata.yaml`. Appspace names come from each `_app.yaml`, so this
 * file only supplies the icon and colour; an unlisted appspace renders with the
 * frontend's default icon and no colour.
 */
function readAppspaceMetadata(yaml: string): Map<string, { icon: string; color: string }> {
  const metadata = new Map<string, { icon: string; color: string }>();
  for (const record of listOfMaps(yaml, "appspaces")) {
    const name = record.name;
    if (!name) continue;
    metadata.set(name, { icon: record.icon ?? "", color: record.color ?? "" });
  }
  return metadata;
}

interface Node {
  name: string;
  children: Map<string, Node>;
}

function addPath(roots: Map<string, Node>, path: string[]): void {
  let siblings = roots;
  for (const name of path) {
    let node = siblings.get(name);
    if (!node) {
      node = { name, children: new Map() };
      siblings.set(name, node);
    }
    siblings = node.children;
  }
}

function toSections(nodes: Map<string, Node>, metadata: Map<string, Section>): Section[] {
  return [...nodes.values()]
    .map((node) => {
      const configured = metadata.get(node.name);
      return {
        name: node.name,
        sort_name: configured?.sort_name || node.name,
        icon: configured?.icon ?? "",
        color: configured?.color ?? "",
        sections: toSections(node.children, metadata),
      };
    })
    .sort((a, b) => a.sort_name.localeCompare(b.sort_name) || a.name.localeCompare(b.name));
}

/** Read the folders and fold them into the generated manifest shape. */
export async function buildDiscovery(): Promise<Manifest> {
  const [metadataYaml, markers] = await Promise.all([readMetadataFile(), findMarkers()]);
  const metadata = readSectionMetadata(metadataYaml);
  const appspaceMetadata = readAppspaceMetadata(metadataYaml);
  const documents = await Promise.all(
    markers.map(async (marker) => ({ marker, yaml: await readTextFile(`${APPS_ROOT}${marker}`) })),
  );
  const appspaces = new Map<string, Map<string, Node>>();
  const apps: App[] = [];

  for (const { marker, yaml } of documents) {
    const fields = scalars(yaml);
    const directory = marker.slice(0, -MARKER.length).replace(/\/$/, "");
    const appspace = fields.appspace || "default";
    const sections = list(yaml, "sections");

    let roots = appspaces.get(appspace);
    if (!roots) {
      roots = new Map();
      appspaces.set(appspace, roots);
    }
    addPath(roots, sections);

    const name = fields.name || directory.split("/").pop() || directory;
    apps.push({
      id: idFromPath(directory),
      name,
      sort_name: fields.sort_name || name,
      description: fields.description ?? "",
      updated: fields.updated ?? "",
      icon: fields.icon ?? "",
      color: fields.color ?? "",
      appspace,
      sections,
      tags: list(yaml, "tags"),
      path: directory,
      url: `/apps/${directory}/${fields.entry || "index.html"}`,
      store: fields.store ?? "",
      db: fields.db ?? "",
      children: list(yaml, "children"),
    });
  }

  apps.sort((a, b) => a.sort_name.localeCompare(b.sort_name) || a.name.localeCompare(b.name));

  const discovery: Manifest = {
    schema_version: 1,
    appspaces: [...appspaces.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, roots]) => ({
        name,
        icon: appspaceMetadata.get(name)?.icon ?? "",
        color: appspaceMetadata.get(name)?.color ?? "",
        sections: toSections(roots, metadata),
      })),
    apps,
  };

  if (markers.length === 0) {
    console.error(
      "Discovery found no _app.yaml markers — the file listing is probably incomplete.",
    );
  }
  return discovery;
}

/** The committed manifest, or null when there is nothing usable to read. */
async function readManifest(): Promise<Manifest | null> {
  try {
    const parsed = JSON.parse(await readTextFile(MANIFEST_FILE));
    const usable = Array.isArray(parsed?.apps) && parsed.apps.length > 0 &&
      Array.isArray(parsed?.appspaces);
    return usable ? parsed as Manifest : null;
  } catch {
    return null;
  }
}

/** Use live folders locally and the precomputed manifest on Val Town. */
export async function discover(): Promise<Discovery> {
  if (cached) return cached;

  let manifest: Manifest | null = null;
  if (ON_VAL_TOWN) {
    manifest = await readManifest();
    if (!manifest) {
      console.error(
        `${MANIFEST_FILE} is missing or unusable — walking Apps/ instead. Run \`deno task manifest\`.`,
      );
    }
  }
  manifest ??= await buildDiscovery();

  const discovery: Discovery = { ...manifest, checkout: localCheckout() };
  if (discovery.apps.length === 0) return discovery;

  cached = discovery;
  return cached;
}

/** `GET /api/apps` — the whole tree and every app record in one response. */
export async function handleApps(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (pathname !== "/api/apps") return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed\n", {
      status: 405,
      headers: { allow: "GET, HEAD" },
    });
  }

  try {
    return Response.json(await discover(), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `Could not read Apps/: ${message}` }, { status: 500 });
  }
}
