# sites5

Plain-HTML app browser. No build step, no framework, no dependencies.

- `public/index.html` — the whole shell: CSS, markup, and one ES module. Edit in place.
- `backends/routes/apps.ts` — walks `Apps/` for `_app.yaml` markers and serves `GET /api/apps`.
- `Apps/<anything>/_app.yaml` + `index.html` — one folder per app. Contract in `Apps/README.md`.
- `shared/app-yaml.ts` — the only YAML reader, a deliberate small subset. The frontend never sees
  YAML.
- `backends/blob.ts` — the only module that knows app storage exists. Val Town's blob store in
  production, `_other/blob/` locally, one `ON_VAL_TOWN` split, exactly as `files.ts` does for
  project files.
- `backends/sqlite.ts` — the same, for app databases: Val Town's SQLite in production, `node:sqlite`
  against `_other/sqlite/` locally. Apps declare tables in `schema.sql` and statements in
  `queries.sql`; `backends/routes/db.ts` serves all of them.

Tasks: `deno task dev`, `deno task check` (fmt + lint + check + test + manifest staleness),
`deno task icons`, `deno task manifest`.

## Running locally

The site is gated on a single shared password in `T1_PASSWORD`. `routes/router.ts` checks it before
any handler runs, so with the variable unset **every** route returns
`503 T1_PASSWORD is not configured.` — including `/login` and `/api/apps`. There is no local bypass.

`.env` supplies it. `dev` and `start` pass `--env-file` to the supervisor, and `serve.ts` spawns the
server without `clearEnv`, so the value is inherited by the process that actually reads it:

```
T1_PASSWORD=your-password    # .env, gitignored; copy from .env.example
```

`deno task check` does not need it — nothing there boots the server. On Val Town the variable comes
from the project's environment-variables UI; `.env` is local only. Overriding it inline still works
(`T1_PASSWORD=x deno task dev`) and takes precedence over `.env`.

## Remote imports in `backends/`

**`deno.json`'s import map does not apply on Val Town.** Project files are served from `esm.town`
over https, and a bare specifier like `@std/yaml` resolves locally and then fails in production with
`not a dependency and not in import map`. The `@std/assert` and `@std/path` entries in `deno.json`
are unused; do not take them as a precedent.

An inline `https:` specifier resolves in both places, but `deno lint`'s `no-import-prefix` rejects
it. So every remote dependency under `backends/` is a pinned URL in a `const`, loaded with
`import(THAT_CONST)` — `files.ts`, `blob.ts`, and `data.ts` all do this. The indirection also keeps
`deno check` from resolving URLs it need not fetch.

Use `https://esm.sh` for anything that is not a Val Town standard-library val, pinned to a version,
per `_other/docs/vt.md`. JSR packages go through it as `https://esm.sh/jsr/@scope/name@version`.

## Adding an app

1. New folder under `Apps/`, copy `_templates/_app.template.yaml` to `_app.yaml`, add `index.html`.
2. Placement in the sidebar comes from `appspace` + `sections`, **not** the folder path. Serving is
   by folder path (`/apps/<folder path>/<entry>`).
3. **Restart the dev server.** Discovery is cached for the life of the process and `Apps/` is not in
   the `dev` watch list, so a new or edited `_app.yaml` will not appear on a page reload.
4. New Iconify name anywhere (app, section, appspace) → run `deno task icons`, or the icon renders
   as blank space.
5. **Run `deno task manifest`** and commit `Apps/_manifest.json` with the change. Nothing local
   reads it — the dev server always walks `Apps/` — but production does, and `deno task check` fails
   while it is stale.

Nothing is registered by hand. `Apps/_manifest.json` is generated from the folders, the same way
`public/shared/icons.svg` is: the tree on disk stays the source of truth, and `deno task check`
refuses a manifest that disagrees with it.

The reason it exists at all is that Val Town has no filesystem. Locally, discovery is a `readDir`
and costs nothing. There, every folder listing and every `_app.yaml` is an HTTP round trip — several
seconds of each cold start spent recomputing something that changes only when somebody edits a
`_app.yaml`. A missing or unusable manifest falls back to the live walk, so a forgotten task is slow
rather than broken.

`store:` names where an app's saved data lives. Apps read and write it with `/shared/store.js`,
which derives the app from `location.pathname`; `backends/routes/data.ts` is one handler for all of
them, so an app that saves needs no backend code. Set `store:` on anything that saves — the fallback
is the app's `id`, which is derived from the folder path and so breaks on a rename.

A key's extension picks its content type and its validator: `.json` (and any unlisted extension)
`JSON.parse`, `.yaml`/`.yml` and `.csv` the matching `@std` parser, `.md`/`.txt` nothing. Those are
full parsers on purpose — `shared/app-yaml.ts` is a subset reader for hand-written `_app.yaml`, and
using it here would reject valid documents.

`children:` lists extra entry points in the app folder. Each becomes an indented row under the app
and opens at `/apps/<folder path>/<file>`, exactly as `entry` does — a child is a page, not a
parameter. Selection rides along in the deep link as `#app=<id>&child=<file>`.

### What is and is not enforced

Nothing in `_app.yaml` is validated. Every field falls back silently, so a typo produces a misplaced
app rather than an error:

- missing `name` → the folder name; missing `appspace` → the appspace literally called `default`
- an `appspace` or `section` absent from `sections-metadata.yaml` → renders with a default icon and
  no colour, which is what a typo'd name looks like
- an app's `id` is its folder path, slugged. It is the `#app=<id>` deep link and the `recent` key in
  `localStorage`, so **renaming or moving a folder breaks existing links and drops it from Recently
  opened.**

## App databases

`store:` is a blob namespace and a table namespace both. An app that wants rows rather than a
document adds three things and no backend code:

```yaml
store: todo2 # As for /api/data/: independent of the folder, so a rename keeps the data.
db: v1 # Schema generation. Absent or malformed means the app has no database.
```

`schema.sql` holds the tables, `queries.sql` the statements, both beside `_app.yaml`. Templates are
in `Apps/_templates/`. The app talks to them through `/shared/db.js`, which derives the app from
`location.pathname` exactly as `store.js` does:

```js
import { db } from "/shared/db.js";
const todos = db();
await todos.run("addTodo", ["milk"]);
const rows = await todos.rows("listTodos");
```

**The browser never sends SQL.** It sends a query _name_ from `queries.sql` plus positional
parameters, and `backends/routes/db.ts` runs the repository's version of that statement. That is
what lets one endpoint serve every app: the session cookie is the only thing between a browser and
this route, and one shared password should not also be the only thing between a browser and
`DROP TABLE`. The cost is real and deliberate — adding a query is a file edit plus a restart, not
something an app can do at runtime. Do not add a passthrough for "just this one dynamic query".

Parameters fill `?` placeholders in order and are bound, never interpolated. Table names cannot be
bound, which is why they are `{tokens}`.

### Tokens and generations

An app writes `{todos}`; the server expands it to `<store>_<generation>_todos`. Val Town gives a val
a single SQLite database, so every app's tables share one flat namespace and a bare `todos` is a
collision waiting for the second app. Two consequences worth remembering:

- `schema.sql` is the declaration. A `{token}` in `queries.sql` that is not created in `schema.sql`
  is an error at load, not a query against a table nobody made.
- index names share that namespace too, so an index is named after its table's token —
  `CREATE INDEX IF NOT EXISTS {todos}_done ON {todos} (...)`.

SQLite cannot `ALTER` most schema changes into place, which is what `db: v1` → `v2` is for: the new
generation gets an empty set of tables, and `migrate.sql` copies the old rows across, naming the old
table as `{prev.todos}`. It runs once, in one transaction with its row in `sites5_migrations`, so a
failed migration leaves nothing half-done. The old generation's tables are left on disk; drop them
by hand once the new one has proved itself. Adding a nullable column needs no generation bump — add
it to `schema.sql` and a plain `ALTER TABLE ... ADD COLUMN` statement below the `CREATE TABLE`.

Schema setup and query parsing are cached for the life of the process, like discovery, so **editing
`schema.sql` or `queries.sql` needs a dev-server restart.** A file that fails to load is not cached,
so fixing a typo needs only a reload.

### The three modules

- `backends/sqlite.ts` — the only module that knows a database exists. One `ON_VAL_TOWN` split, as
  `blob.ts` and `files.ts` have: Val Town's client in production, `node:sqlite` against
  `_other/sqlite/apps.db` locally. It normalises both drivers to
  `{rows, rowsAffected,
  lastInsertRowid}` so nothing above it branches on where it is running.
- `shared/app-sql.ts` — pure text: statement splitting, comment stripping, token expansion, named
  query parsing. It sits apart from the route for the same reason `app-yaml.ts` does — the awkward
  parts are testable without a driver. Same deliberate subset, too: a semicolon inside a string
  literal or a `CREATE TRIGGER` body will split in the wrong place, and the day an app needs one is
  the day this grows a real splitter.
- `backends/routes/db.ts` — one handler for every app, the counterpart to `data.ts`.

## App colors and the sidebar

The shell copies live styles out of the preview iframe onto its own chrome:

- iframe `body`/`html` `background-color` + `background-image` → sidebar glass, `--preview-bg`
- iframe `:root --accent` → icon tint, selected row, `--app-color`
- background luminance → `body[data-preview-tone="light|dark"]`, which reskins the whole shell

So when you change an app's look, do all three:

1. Set `:root { --accent: ... }` in the app so the shell can read it.
2. Set the same hex in that app's `_app.yaml` `color:` so the tree icon matches before the iframe
   loads.
3. Put page backgrounds on `body` (color and/or image), not only on an inner card — an inner card is
   invisible to the sync.

Never restyle an app's CSS without updating its `_app.yaml` `color`.

An app that changes its background at runtime should
`parent.postMessage({ type: "gallery-preview-bg-changed" }, "*")`; the shell re-reads it. Everything
in this section is same-origin only and fails silently for cross-origin apps.

## Markup rules for `public/index.html`

The static shell bottoms out around 8 levels and is already flat. Do not "simplify" it by trading
wrapper elements for grid/subgrid placement — that moves complexity out of markup, where it is
visible, and into CSS, where it is not. Specifically, leave these alone:

- `#root-copy`, `#preview-message` — one wrapper each, cheaper than the grid rules that would
  replace them.
- `#sidebar-header` — `#sidebar[data-width="collapsed"] > *` hides its direct children, and the
  900px override re-shows them; flattening changes what that selector means.
- `.tree-group` > `.tree-children` — collapse is `children.hidden`; search filtering reads
  `dataset.hasMatches` and `childElementCount`.
- `.app-row` wrapping a button plus an external `<a>` — two separate controls, deliberate.
- `svg.icon > use` — sprite requirement. The sprite is fetched and inlined into `#icon-sprite`
  because browsers will not follow `<use>` into an external file.
- `#app` — `body` also holds the sprite, backdrop, and toggle.

Every static control has an id; generated nodes derive ids from the app or section path. Keep that.

### Tuning blocks

Two commented blocks hold the values worth changing: CSS custom properties at the top of `:root`,
and named constants at the top of the module. Rules and code are written in terms of them, so change
the dial rather than the literal, and put a new tunable in the block rather than inline.

Two of them are contracts, not preferences:

- `MOBILE_QUERY` in the script must equal the `@media (max-width: 900px)` breakpoint in the
  stylesheet. It cannot be a custom property — CSS variables are not allowed in media queries — so
  the two are changed together by hand.
- the tree's bottom padding is `calc(var(--toggle-size) + var(--toggle-inset) * 2)`, so the last row
  clears the floating toggle at any size. Do not re-hardcode it.

`DEFAULT_*_ICON` names must exist in the sprite; run `deno task icons` after changing one.

`renderTree()` rebuilds the sidebar wholesale, and that is the intended design for anything that
changes _what_ the tree contains — search, view switches, appspace switches, opening an app. It
costs ~4ms at 50 apps. Do not add incremental diffing.

Collapsing is the exception, and it is handled by `syncCollapsed()` instead. Expanding or collapsing
cannot change anything a re-render would compute differently — same labels, same counts, same
ordering, same app rows — so it flips `aria-expanded` and `.tree-children.hidden` in place on the
nodes already on screen. That is not an optimisation:

- rebuilding destroys the button the user just activated, dropping keyboard focus to `<body>`. Tab
  then restarts from the top of the page, so a keyboard user cannot move past a section they just
  collapsed.
- the chevron's `transition: transform .2s ease` can never run if the element is replaced mid-flip.
  On the rebuild path that rule was dead CSS.

So: state changes that alter tree _contents_ → `renderTree()`. State changes that only alter
_disclosure_ → `syncCollapsed()`. `.tree-group` carries `data-section-id` so the second one can find
its nodes, and `data-search-aware` because the app tree force-expands during a search while the
updated tree does not.

## Theme

`color-scheme: light dark` plus `light-dark()` tokens on `:root`, overridden by
`body[data-preview-tone]`. Do not add a second theme mechanism: no class toggles, no JS theme state,
no media-query duplicates beyond the one dark `--glass-bg` override.

## Notes

- `CLAUDE.md` and `AGENTS.md` are byte-identical on purpose. Change both.
- Frontend state is one `localStorage` key, `s5.frontend`; deep links are `#app=<id>`.
- Folders under `Apps/` starting with `_` or `.` are skipped by discovery, which is why
  `_templates/` is not an app.
