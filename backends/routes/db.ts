/**
 * App databases over HTTP: `POST /api/db/<app path>`.
 *
 * The counterpart to `routes/data.ts`, and built on the same bet: one route for
 * every app rather than one route per app. An app that wants tables adds
 * `db: v1` to its `_app.yaml`, a `schema.sql`, and a `queries.sql`, and writes
 * no backend code at all — `public/shared/db.js` derives the URL from
 * `location.pathname` exactly as `store.js` does, so the app does not even name
 * itself.
 *
 * ## The client never sends SQL
 *
 * A request names a query and supplies its parameters:
 *
 *     POST /api/db/meta/main/todo2
 *     { "query": "addTodo", "params": ["milk"] }
 *
 * The SQL behind `addTodo` lives in the app's `queries.sql`, in the repository,
 * where it is reviewed like any other code. This is the whole reason a single
 * endpoint can be shared by every app: the session cookie is the only thing
 * between a browser and this handler, and one shared password should not also
 * be the only thing between a browser and `DROP TABLE`. The cost is that adding
 * a query is a file edit and a restart rather than something an app does at
 * runtime.
 *
 * Parameters are positional `?`, which both drivers agree on, and are bound —
 * never interpolated. Table names cannot be parameterised, which is why they
 * are `{tokens}` resolved from the app's own `schema.sql` rather than anything
 * a request can influence.
 *
 * ## Setup is lazy and idempotent
 *
 * The first request for an app runs its `schema.sql`, whose statements are
 * `CREATE TABLE IF NOT EXISTS`, then its `migrate.sql` if one exists and this
 * generation has not been migrated before. Both are cached for the life of the
 * process, like discovery — so a schema edit needs a dev-server restart, for
 * the same reason and with the same surprise.
 *
 * Auth is already settled: `routes/router.ts` rejects anything without a valid
 * session before any handler runs.
 */

import { readTextFile } from "../files.ts";
import { batch, execute } from "../sqlite.ts";
import { type App, discover } from "./apps.ts";
import {
  declaredTables,
  expand,
  GENERATION,
  isIdentifier,
  MIGRATIONS_TABLE,
  previousGeneration,
  queries,
  SqlError,
  statements,
} from "../../shared/app-sql.ts";

const ROUTE = "/api/db/";
const APPS_ROOT = "Apps/";

/** Room for a paste, not for a payload. Rows come back unbounded by design. */
const MAX_BYTES = 1024 * 1024;

interface Prepared {
  store: string;
  generation: string;
  queries: Map<string, string>;
}

/** One entry per app, for the life of the process. */
const prepared = new Map<string, Promise<Prepared>>();

export function clearDatabaseCache(): void {
  prepared.clear();
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readTextFile(path);
  } catch {
    return null;
  }
}

/**
 * Create this app's tables and run its migration, then parse its queries.
 *
 * Everything that can fail on a typo fails here, on the app's first request,
 * with a message naming the file — rather than later as a confusing SQL error
 * from a table nobody created.
 */
async function prepare(app: App): Promise<Prepared> {
  const generation = app.db;
  const store = app.store || app.id;
  const folder = `${APPS_ROOT}${app.path}/`;
  const where = (file: string) => `${app.path}/${file}`;

  const schemaSql = await readOptional(`${folder}schema.sql`);
  if (schemaSql === null) {
    throw new SqlError(
      `${where("schema.sql")} is missing, but _app.yaml declares db: ${generation}.`,
    );
  }

  const known = new Set(declaredTables(schemaSql));
  if (known.size === 0) {
    throw new SqlError(`${where("schema.sql")} declares no {table} tokens.`);
  }

  const resolve = (sql: string, file: string, allowPrevious = false) =>
    expand(sql, { store, generation, known, allowPrevious, where: where(file) });

  await execute(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      namespace TEXT NOT NULL,
      generation TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      PRIMARY KEY (namespace, generation)
    )`,
  );

  await batch(
    statements(resolve(schemaSql, "schema.sql")).map((sql) => ({ sql })),
  );

  const migrateSql = await readOptional(`${folder}migrate.sql`);
  if (migrateSql && previousGeneration(generation)) {
    const done = await execute(
      `SELECT 1 FROM ${MIGRATIONS_TABLE} WHERE namespace = ? AND generation = ?`,
      [store, generation],
    );
    if (done.rows.length === 0) {
      // One batch, so a migration that fails half way leaves no partial copy
      // and no bookkeeping row — the next request tries the whole thing again.
      await batch([
        ...statements(resolve(migrateSql, "migrate.sql", true)).map((sql) => ({ sql })),
        {
          sql: `INSERT INTO ${MIGRATIONS_TABLE} (namespace, generation, applied_at)
                VALUES (?, ?, ?)`,
          params: [store, generation, new Date().toISOString()],
        },
      ]);
    }
  }

  const querySql = await readOptional(`${folder}queries.sql`);
  if (querySql === null) throw new SqlError(`${where("queries.sql")} is missing.`);

  const parsed = new Map<string, string>();
  for (const [name, sql] of queries(querySql)) parsed.set(name, resolve(sql, "queries.sql"));
  if (parsed.size === 0) throw new SqlError(`${where("queries.sql")} defines no queries.`);

  return { store, generation, queries: parsed };
}

function preparedFor(app: App): Promise<Prepared> {
  let entry = prepared.get(app.path);
  if (!entry) {
    // A failed preparation is not cached: the next request re-reads the files,
    // so fixing a typo needs a reload rather than a restart.
    entry = prepare(app).catch((error) => {
      prepared.delete(app.path);
      throw error;
    });
    prepared.set(app.path, entry);
  }
  return entry;
}

/**
 * Create every declared app's tables if they are not there yet.
 *
 * Schema setup is otherwise lazy — a table does not exist until that app is
 * first queried. The inspector needs the catalog to match `_app.yaml`, so it
 * warms every database app before listing. A broken schema.sql is skipped so
 * one typo cannot hide the rest of the file.
 */
export async function ensureDeclaredTables(): Promise<void> {
  const { apps } = await discover();
  for (const app of apps) {
    if (!GENERATION.test(app.db)) continue;
    try {
      await preparedFor(app);
    } catch {
      // Leave this app out of the catalog rather than failing the whole list.
    }
  }
}

/** The app whose folder the URL names, or null. */
async function resolveApp(pathname: string): Promise<App | null> {
  const rest = decodeURIComponent(pathname.slice(ROUTE.length));
  if (rest.includes("\0")) return null;
  const path = rest.split("/").filter(Boolean).join("/");
  if (!path) return null;
  return (await discover()).apps.find((candidate) => candidate.path === path) ?? null;
}

export async function handleDb(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(ROUTE)) return null;

  if (request.method !== "POST") {
    return new Response("Method not allowed\n", { status: 405, headers: { allow: "POST" } });
  }

  const app = await resolveApp(pathname);
  if (!app) return json({ error: "No such app." }, 404);
  if (!GENERATION.test(app.db)) {
    return json({ error: "That app does not declare a database." }, 404);
  }

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) {
    return json({ error: "Request is too large." }, 413);
  }

  let body: { query?: unknown; params?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body is not JSON." }, 400);
  }

  const name = typeof body.query === "string" ? body.query : "";
  if (!isIdentifier(name)) return json({ error: "Request names no query." }, 400);

  const params = body.params ?? [];
  if (!Array.isArray(params)) return json({ error: "params must be an array." }, 400);

  let plan: Prepared;
  try {
    plan = await preparedFor(app);
  } catch (error) {
    // A schema or query file the app author got wrong, which is worth saying
    // plainly rather than as a 500.
    const detail = error instanceof Error ? error.message : String(error);
    return json({ error: detail }, error instanceof SqlError ? 400 : 500);
  }

  const sql = plan.queries.get(name);
  if (!sql) return json({ error: `No query named "${name}" in queries.sql.` }, 404);

  try {
    const result = await execute(sql, params);
    return json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return json({ error: `Query "${name}" failed: ${detail}` }, 400);
  }
}
