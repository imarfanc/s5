---
name: sites5-app-parity
description: Build, port, or audit an app in the sites5 gallery repo so it matches the house baseline. Covers picking a reference app, _app.yaml fields, the appspace and sections contract in sections-metadata.yaml, store/db, schema.sql and queries.sql, /shared/db.js and /shared/store.js, optional per-app backends under backends/apps/ for host tools, theme tokens and shell accent sync, stable ids, dialogs and ARIA, optional view/mode/modal/context-menu UX, and the icons/manifest/check loop. Use this whenever work touches a folder under Apps/, whenever the user says parity, checklist, baseline, "same as my other apps", "like notes-notes", "match the gallery", or asks why an app landed in the wrong appspace, shows the wrong icon, ignores dark mode, or reports an unknown query.
---

# sites5 app parity

A checklist for apps that live under `Apps/` in the sites5 gallery repo.
Serving is the folder path (`/apps/<folder path>/<entry>`). Sidebar
placement is `appspace` plus `sections` in `_app.yaml`, not the folder
name. A dated bucket such as `Apps/26.8.21-repos/files-i1/` is normal.

The house style is plain HTML plus one ES module: no framework, no build
step. Most apps also have no backend. Host-local tools (search a folder,
talk to git, spawn `osascript`) are the exception, not the default.
Everything below exists because breaking it produces a specific, annoying
bug. The reasons sit next to the rules so you can tell a real constraint
from a habit.

**Tier 1 is required.** Tier 2 is recommended: take each item or decline it
out loud. Tier 3 is a menu, not a mandate. Snippets are in
[PATTERNS.md](PATTERNS.md).

## Step 0. Read the repo before trusting this file

This checklist describes conventions, not a frozen snapshot. Folder names,
appspaces, and task names drift. Spend the first two minutes confirming
what is actually there, then follow the repo over this file wherever they
disagree — and say so, so the skill can be corrected.

```
Orient
- [ ] ls Apps/            → the current appspace folders
- [ ] cat Apps/sections-metadata.yaml   → legal appspace and section names
- [ ] ls Apps/_templates/ → which templates exist to copy from
- [ ] ls Apps/_shared/ and the /shared/ modules the apps import
- [ ] ls backends/apps/ if the work might spawn or touch the host
- [ ] grep '"tasks"' -A20 deno.json (or the repo's task file) → real task names
- [ ] Pick a reference app (below) and read its index.html and _app.yaml
```

**Picking a reference app.** Do not copy from memory. Choose the app in the
repo that is closest to what is being built: same appspace if possible,
database-backed if the new app needs rows, document-backed if it does not,
host-backed (`files-i1`, `my-repos-v1`) if it spawns. Read it end to end. `Apps/_manifest.json` lists every app with its
metadata, which makes it the fastest way to find candidates. Prefer the
most recently `updated:` app in the target appspace, since that is the one
whose conventions are freshest. Name the app you picked in your notes; the
rest of this checklist reads as "does the new app hold up next to that one".

If the user names a reference app ("like notes-notes", "same as todo1"),
use theirs. If that app no longer exists, say so plainly and pick the
nearest survivor rather than inventing its details from this file.

## Tier 1. Required baseline

```
Tier 1
- [ ] Folder Apps/<anything>/<name>/ with an entry file (usually index.html)
- [ ] _app.yaml copied from Apps/_templates/_app.template.yaml
- [ ] schema_version matches the template's current value
- [ ] name, sort_name, description, updated, icon, color, appspace, sections, tags, entry
- [ ] appspace matches an appspaces: name in Apps/sections-metadata.yaml
- [ ] every sections: entry matches a sections: name in that same file
- [ ] children: lists any extra entry points, else []
- [ ] store: set to a stable namespace whenever the app saves anything
- [ ] db: set (v1, v2, ...) only if the app needs tables; empty otherwise
- [ ] If db: schema.sql and queries.sql copied from the matching templates
- [ ] Every {token} used in queries.sql is created in schema.sql
- [ ] Indexes named after their table token, not a bare name
- [ ] Browser talks through /shared/db.js or /shared/store.js for saved data
- [ ] Browser sends query names, never SQL strings
- [ ] If the app needs the host (fs, git, spawn): backends/apps/<id>/ plus a
      /api/apps/<id>/ prefix registered in backends/routes/router.ts
- [ ] That prefix returns null for unrelated paths so later handlers still run
- [ ] :root { --accent } in the app CSS
- [ ] The same hex in _app.yaml color:
- [ ] Page background painted on body, not only on an inner card
- [ ] color-scheme: light dark on :root, or color-scheme: dark for a toolkit
      that is always dark
- [ ] Tokenized surfaces; OS-following apps add one prefers-color-scheme dark
      override, always-dark apps skip it
- [ ] No class or data-theme toggle and no second theme mechanism
- [ ] Any new Iconify name → run the repo's icon vendoring task
- [ ] Run the manifest task, then the check task
- [ ] Dev server restarted after any yaml, sql, or backends/ edit
```

**Why the metadata is fussy.** `_app.yaml` fields fall back silently, so a
typo does not error — it just puts the app somewhere unexpected with a
default icon. An `appspace` or `sections` value with no match in
`Apps/sections-metadata.yaml` lands the app in an unstyled space of its
own. If the app genuinely needs a new appspace or section, add it to that
file rather than letting it fall back, and restart the server.

**Why `store:` is separate from the folder.** The app `id` is the folder
path slugged. Renaming the folder breaks `#app=` links and drops the app
from Recently opened; if storage were keyed on the folder, the rename would
also orphan every saved row. Setting `store:` explicitly makes the rename
survivable.

**Rows versus documents.** If the app saves documents rather than tables,
skip `db:` and the SQL files and use `/shared/store.js` with `store:` set.
Saved data still never gets a SQL passthrough or a custom `/api/data`
clone. One shared password is already the only lock on those routes.

**Host-local backends.** Spawn, `$HOME`, Trash, git, Keyboard Maestro, and
friends cannot go through `store:` or `queries.sql`. Those apps live as a
pair: `Apps/.../<id>/` for the UI and `backends/apps/<id>/` for the API.
The browser calls `/api/apps/<id>/...` only. The handler is a named export
on `HANDLERS` in `backends/routes/router.ts`. Look at `files-i1`,
`my-repos-v1`, or `script-runner` rather than inventing a second server.

That handler still does not run raw SQL from the browser, and it does not
delete with `Deno.remove`. Scan, then trash. Paths stay under `$HOME` with
an explicit denylist. Return the argv you actually ran as `command` so the
UI can echo it.

Host binaries (`rg`, `fd`, `tree`, `git`) are whatever is on the **Deno
server's PATH**, not Cursor's bundled tools. A health endpoint should
probe them, grey the UI when they are missing, and show the brew line.
Do not debounce-submit a search or fuzzy filter on every keystroke.

Remote imports under `backends/` stay pinned URL constants plus
`import(THAT_CONST)`. `deno.json`'s import map does not apply on Val Town.

**Migrations.** A change SQLite can express as `ALTER TABLE ... ADD COLUMN`
can go under the `CREATE TABLE` in `schema.sql`. Anything SQLite cannot
alter in place needs a generation bump (`db: v1` → `v2`) plus a
`migrate.sql` copied from the migrate template.

**Restarts.** Discovery and SQL load are cached for the process lifetime,
and `Apps/` is not watched. After editing `_app.yaml`, `schema.sql`,
`queries.sql`, `sections-metadata.yaml`, or anything under `backends/`,
restart the dev server. A page reload will not pick those up, and the
resulting "missing app" or "unknown query" looks like a code bug for
about ten minutes. HTML, CSS, and app JS in the iframe do reload.

## Tier 2. Recommended

These are the things a well-built app in this repo has. Take them unless
there is a reason not to, and record the declines.

```
Tier 2
- [ ] Stable id on every landmark and interactive control
- [ ] Generated rows carry data-<thing>-id, never loop-generated ids
- [ ] List and card items are flat: title / preview / meta live on the <li>
- [ ] No anonymous wrapper div inside items
- [ ] Dialogs: role="dialog" aria-modal="true" aria-labelledby
- [ ] Live region: role="status"
- [ ] Context menu: role="menu" with role="menuitem" children
- [ ] Destructive buttons: aria-label naming the specific item
- [ ] A --scrim token reused by every overlay
- [ ] Accent text tokens named for their surface, shared by CSS and JS
- [ ] Runtime accent or background change notifies the shell, in try/catch
- [ ] Every localStorage read and write in try/catch
- [ ] An audit note under the repo's docs folder with an "Applied" section
```

**Ids follow the app, not a global prefix.** Pick one prefix from the app's
own name and use it consistently for landmarks (`<app>-main`,
`<app>-title`, `<app>-hint`) and for named modal actions
(`<app>-modal-primary`, `<app>-modal-secondary`). The point is that a test,
a selector, or a later edit can address any part of the page without
counting siblings. Loop-generated ids break that the moment the list
reorders, which is why generated rows get a data attribute instead.

**The flat-item rule is a layout constraint, not taste.** Grid views size
the preview with `flex: 1` on a child of the `<li>`. An anonymous wrapper
`div` swallows that, and the card silently stops filling.

**The shell contract, which is easy to break while restyling:**

1. The iframe's `:root --accent` tints the sidebar icon and the selected row.
2. The iframe's `body`/`html` background paints the stage, not the sidebar.
3. A dark-looking app must not drag the chrome dark while the OS is light.

So: never restyle an app's accent without updating `_app.yaml` `color:`,
and post a message to the parent whenever accent or background changes at
runtime, wrapped in `try/catch` for the unframed case (see PATTERNS.md).

A host toolkit that is always dark (`color-scheme: dark` on `:root`, dark
`body`) will darken the gallery chrome. That is the contract working, not
a bug. Paint `body` anyway so the iframe and the shell agree. Keep
`--accent` and `_app.yaml` `color:` the same hex.

`pre.output` that shows `tree` or tldr needs a real mono (IBM Plex Mono
is the files-i1 pick), `line-height: 1` so `│` joins, and ligatures off
so `├──` stays box drawing. Copy strips ANSI. Paint SGR in the pane.

## Tier 3. Optional UX

A menu. Ask which of these the app wants; do not add them by default.
Implementation notes live in [PATTERNS.md](PATTERNS.md).

```
Tier 3
- [ ] Persisted view cycling (list / grid) behind <store>.view
- [ ] Persisted mode cycling (normal / zen / edit) behind <store>.mode
- [ ] One modal serving new / edit / view, chrome from a single sync function
- [ ] Right-click context menu, position clamped to the viewport
- [ ] Two-step inline delete that resets siblings and restores aria-label
- [ ] Keyboard shortcuts plus a "/" help sheet that flashes the matching kbd
- [ ] Cover image with a canvas-sampled accent
- [ ] Accent text chosen by sampled luminance against the named tokens
- [ ] Copy to clipboard with a status flash
- [ ] Host toolkit: tool rail, live command line, wait ticker on Working…
```

Namespace every persisted key as `<store>.<thing>` so two apps in the same
origin cannot collide.

## Verification

```
Verify
- [ ] The repo's check task passes (fmt, lint, typecheck, tests, manifest)
- [ ] Grep: every selector you touched still matches the markup
- [ ] Manual: each view that exists (list, grid, ...)
- [ ] Manual: light and dark OS appearance
- [ ] Manual: each modal state that exists (new, edit, view)
- [ ] Manual: zen / edit / help / context menu, if present
- [ ] Empty state and error status still render
- [ ] The app appears in the right appspace and section with the right icon
- [ ] If it has a backend: health, a missing binary greys the tool, command echo
```

The check task fails while the generated manifest is stale — production
reads the manifest while local dev walks `Apps/`, so a stale manifest is an
app that works for you and is missing for everyone else. Commit the
regenerated manifest alongside the app.

## What not to do

- Do not add a SQL passthrough. Saved rows go through `queries.sql`.
- Do not add a per-app backend for notes, todos, or other document apps.
  Host spawn and filesystem work is the reason `backends/apps/<id>/` exists.
- Do not register an app by hand. Folders plus `_app.yaml` are the source
  of truth; the manifest is generated from them.
- Do not add a theme toggle to an app. The shell follows the OS, or a
  dark toolkit that paints `body` and lets the shell copy it.
- Do not restructure the gallery shell itself. This checklist is for apps
  under `Apps/`.
- Do not skip the restart after a yaml, SQL, or `backends/` edit and then
  spend the afternoon debugging a cache.
- Do not copy a snippet from PATTERNS.md unchanged into an app whose ids
  and store name differ. The snippets use placeholders on purpose.
- Do not treat Cursor's `rg` as on PATH. Probe the process that serves
  `/api`.
