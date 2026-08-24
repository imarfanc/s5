---
name: standardize-vt5-app
description: Standardize one existing app inside the vt5 repository without changing its behavior. Use when asked to organize an app under MAIN/apps or MAIN/pages, bring its _app.yaml marker up to schema_version 2, normalize its justfile recipes, port variable, Gum recipe picker and terminal styling, add Chrome and Helium launch modes, version frontend files under frontends/v1, move documentation into docs and configuration data into data, or prepare an app for additional frontend versions.
---

# Standardize a vt5 App

Standardize **one** app per invocation. Preserve its runtime, behavior, API
routes, user changes, and app-specific recipes. This skill reshapes structure
and tooling; it does not add features.

Related skill: `.claude/skills/migrate-app/` brings an app _into_ vt5 from
another repository. Use that first if the app is not in vt5 yet, then use this
one to standardize it.

## Repository facts to hold in mind

- Rules live in `CLAUDE.md` at the repository root. `AGENTS.md` points at it.
- The content reference is `docs/content-system/CONTENT-SYSTEM-GUIDE.md`.
- Only two markers exist: `_section.yaml` and `_app.yaml`, both
  `schema_version: 2`. Exactly one marker per folder. Folder structure defines
  membership; the folder name defines the URL.
- **Static browser apps** may live under `MAIN/pages/`. **Non-static apps must
  live under `MAIN/apps/`**, use a non-browser runtime (`deno`, `node`,
  `python`), and have a `justfile` whose first line begins with
  `# just-runner-doc:`.
- Shared assets live at `/shared/` (`shared/css/`, `shared/js/`). Never copy
  them into an app.
- `tmp/` is scratch and is never a deliverable.
- `just validate` must pass with zero errors and zero warnings.

Do not introduce `slug`, `group`, `scope`, `_page.yaml`, or any retired
group/category/shelf/collection marker. If you find one, that is a bug to fix.

## Inspect first

1. Read the root `CLAUDE.md` and any app-local `CLAUDE.md` or `README.md`.
2. Inspect `_app.yaml`, the `justfile`, the server entry point, frontend files,
   data files, docs, and `git status` for the app.
3. Confirm the port and entry point recorded in `_app.yaml`. Check the port is
   not already claimed: `grep -rn "port" MAIN --include=justfile`.
4. Search for every path that will move before editing anything.
5. Note whether the app is in the right tree. A non-static app under
   `MAIN/pages/` must move to `MAIN/apps/`, and a purely static browser app
   belongs under `MAIN/pages/`.

Do not assume every HTML, CSS, or JavaScript file is a frontend file. Classify
from imports, server routes, and build configuration.

## Organize the app

Target shape, applied only to files that actually exist:

```text
MAIN/apps/<section...>/<app>/
├── _app.yaml
├── justfile
├── server entry point
├── frontends/
│   └── v1/
│       └── current frontend files
├── data/
│   └── existing data and configuration files
└── docs/
    └── existing documentation and TODO files
```

Keep filenames unless asked to rename. After every move, update `_app.yaml`,
server paths, imports, scripts, docs, and frontend references.

Walking down from `MAIN/apps/`, every navigational ancestor folder needs a
`_section.yaml`, copied from
`MAIN/tooling/templates/marker-templates/_section.yaml`.

For versioned frontends:

- Serve `/` from `frontends/v1` by default.
- Support `/v1` and `/v1/...` from the same directory where the server can route
  versions directly.
- Keep API, `/shared/`, and app-specific asset routes ahead of frontend fallback
  routing.
- Make a future `frontends/v2` possible without restructuring the server again.
- Keep path-traversal checks correct after changing the static root.

## Bring `_app.yaml` to schema v2

Copy any missing structure from
`MAIN/tooling/templates/marker-templates/_app.yaml`. Fill it completely:

```yaml
kind: app
schema_version: 2
name: Repo Sync
description: Sync repositories on a schedule
status: active # active | wip | archived

app:
  static: false
  availability: local # local | remote | both
  runtime: deno # browser | deno | node | python
  entry_file: server.ts
  storage:
    - kind: deno-kv # localstorage | indexeddb | deno-kv | sql
      name: repo-sync
      tables: [runs]

display:
  icon: lucide:refresh-cw
  color: "#2f6c5b"

timestamps:
  created: "2026-07-24T14:00"
  updated: "2026-07-24T14:00"

origin:
  repository: web-apps
  path: WEB-APPS/repo-sync

tags: [developer]
```

Rules the validator enforces:

- `app.storage` is always a list; use `[]` when nothing is stored.
- Timestamps are local time in `YYYY-MM-DDTHH:MM` form. Update `updated`.
- `order` is a string; blank values sort alphabetically after explicit ones.
- `entry_file` must exist on disk — moving files into `frontends/v1/` without
  updating it produces `missing-entry-file`.
- Preserve `origin.repository` and `origin.path` if the app was migrated.

## Normalize the justfile

Keep `# just-runner-doc:` on line 1. Put one configurable port near the top,
matching the port in `_app.yaml`. Keep `_default` as the first recipe. Prefer
Gum for the picker with the built-in Just chooser as a fallback:

```just
# just-runner-doc: Describe the app

port := "8000"

_default:
    #!/usr/bin/env bash
    set -euo pipefail
    if command -v gum >/dev/null 2>&1; then
        recipe="$(just --summary --unsorted | tr ' ' '\n' | gum choose \
            --header 'Choose a recipe' \
            --cursor '󰌌 ' \
            --selected-prefix '󰄬 ' \
            --height 12)"
        [ -z "$recipe" ] || just "$recipe"
    else
        printf '\n󰀦 Gum is not installed; using the basic Just chooser.\nInstall Gum: https://github.com/charmbracelet/gum\n\n' >&2
        just --unsorted --choose
    fi
```

Keep picker labels short and sentence case. Do not make Gum a dependency and do
not install it from a recipe; detect it at runtime so standardized apps stay
usable without it. When Gum is missing, print one concise alert with the
[charmbracelet/gum](https://github.com/charmbracelet/gum) link before falling
back.

Order visible recipes as follows, then keep app-specific recipes after them:

1. `start-and-open-helium`
2. `start-and-open-chrome`
3. `start-and-open-helium-app`
4. `start-and-open-chrome-app`
5. `start`
6. `serve`
7. `open`
8. `dev`
9. Remaining app-specific recipes

Behavior:

- `start-and-open-helium` — foreground server, wait until it responds, open the
  URL in a normal Helium window
  (`/Applications/Helium.app/Contents/MacOS/Helium`).
- `start-and-open-chrome` — foreground server, wait until it responds, open the
  URL in a normal Google Chrome window.
- `start-and-open-helium-app` — same as `start-and-open-helium`, but use
  Helium with `--app=<url>`
  (`/Applications/Helium.app/Contents/MacOS/Helium`).
- `start-and-open-chrome-app` — same as `start-and-open-chrome`, but use
  Google Chrome with `--app=<url>`.
- `start` — the normal foreground server command.
- `serve` — equivalent alias or command, without creating a dependency loop.
- `open` — open an already-running app in Chrome without starting a server.
- `dev` — the runtime's supported watcher. Omit only if no safe dev command
  exists.

Use the port variable in every command and URL, and export `PORT` to the server
process if it accepts one. Use the app's real runtime — do not copy Node
commands into a Deno, Go, or Python app. Preserve install, build, environment,
and graceful-shutdown behavior. Never kill an existing process just to claim the
configured port.

The root `justfile` discovers app justfiles through `just jf <name>` and runs
recipes through `just jr <name> <recipe>` (these currently require a Go
toolchain via `MAIN/scripts/go`).

### Style terminal output

Give foreground server recipes a compact startup banner and meaningful status
lines, where doing so does not suppress or buffer the server's own output.
`server/terminal/console.ts` and `server/terminal/icons.ts` in this repository
are the references for tone: timestamped, levelled, structured, restrained.

#### MesloLGS Nerd Font symbols

Terminal output assumes **MesloLGS Nerd Font** (matches root
`.vscode/settings.json` `terminal.integrated.fontFamily`). Use the Nerd Font
glyphs below for banners, panels, picker prefixes, and status lines. Do not use
`figures`, ASCII stand-ins, or other emoji except the two listed at the end.

When the font cask is not installed, print one concise line after the first
styled panel or banner:

`MesloLGS Nerd Font for icons → brew install --cask font-meslo-lg-nerd-font`

Detect with `brew list --cask font-meslo-lg-nerd-font` when you need to decide
whether to show that hint. Do not scan `~/Library/Fonts` or widen Deno
`--allow-read` for font files.

| Role            | Glyph | Code point | Use                                                    |
| --------------- | ----- | ---------- | ------------------------------------------------------ |
| Server / URL    | 󰖟     | U+F059F    | app URL, http-server, web links in banners             |
| Folder          | 󰉋     | U+F024B    | paths, directory labels, panel titles                  |
| Keyboard        | 󰌌     | U+F030C    | stop hint (`press Ctrl+D` / `Ctrl+C`)                  |
| OK              | 󰄬     | U+F012C    | success, passing checks, picker selection              |
| Warning         | 󰀦     | U+F0026    | warnings, missing Gum alert                            |
| Error           | 󰅙     | U+F0159    | errors, failures                                       |
| Starting server | 🌼    | —          | startup banner or `starting server` lifecycle log only |
| Shutdown        | 👋    | —          | graceful shutdown log only (`shutting down`, `via=…`)  |

🌼 and 👋 are the **only** emoji in terminal output. Every other symbol comes
from the Nerd Font set above.

- Detect Gum with `command -v gum`; always keep a readable plain-text or ANSI
  fallback. Write one concise missing-Gum alert to stderr before using it. Use
  󰀦 in that alert. Do not block, prompt, or install.
- Banner: `gum style --border rounded --border-foreground 212 --padding "0 2"
  --margin "1 0"`. Lead with 🌼 on the starting-server line, then 󰖟 for the
  URL, runtime command, and 󰌌 `press Ctrl+D (or Ctrl+C) to stop`. Clamp width to
  the terminal.
- Logs: `gum log --time kitchen --level info|warn|error --structured` for
  lifecycle messages (waiting, ready/opening, missing browser, startup failure),
  passing `url`, `port`, or `runtime` as structured pairs. Prefix a 🌼
  `starting server` info line when the process is about to listen.
- Set `CLICOLOR_FORCE=1` only for Gum invocations. Honor `NO_COLOR` in the
  fallback and skip decoration when stdout is not a terminal.
- Keep the accent restrained: 212 for the banner border, normal Gum level colors
  for logs, dim text for secondary detail, no ASCII art.
- Keep the server in the foreground with `exec` after printing the banner and
  starting any readiness watcher. Preserve exit codes and signal handling.
- When the runtime can read terminal stdin, support Ctrl+D as a graceful
  shutdown alongside Ctrl+C and SIGTERM. Log shutdown once with 👋, the
  trigger, and structured `via=Ctrl+D` (or `Ctrl+C`, `SIGTERM`).

Example banner body (Gum `style` input):

```text
🌼 starting markdown-browser
󰖟 http://localhost:8000/
deno task serve
󰌌 press Ctrl+D (or Ctrl+C) to stop
```

Example shutdown log: `👋 shutting down via=Ctrl+D`.

Factor repeated banner/log shell into a private recipe or a short app-local
script when it would otherwise be duplicated. Do not reach into another app's
runner at runtime; other apps are visual references, not dependencies.

## Validate

1. `just validate` from the repository root — must report **0 errors, 0
   warnings**. `docs/content-system/VALIDATION-CODES.md` maps codes to fixes when present.
2. `just test` if anything under `server/` changed.
3. Format the justfile and inspect `just --list --unsorted`. Dry-run the standard
   recipes. Exercise `_default` with and without Gum, and confirm cancelling does
   not launch a recipe.
4. Run the runtime's own syntax or configuration check.
5. Search for stale paths and hard-coded copies of the port:
   `grep -rn "<old-path>\|<port>" MAIN/apps/<app>`.
6. `git diff --check`, then inspect the focused diff and status without changing
   existing staging state.
7. If the port is free, start the server and verify `/`, `/v1`, essential assets,
   and at least one data-backed API route. Stop only the process you started,
   using Ctrl+D when stdin is available; confirm the graceful shutdown log uses
   👋, names the trigger, and includes `via=…`. If `/` and `/v1` should be
   identical, compare response hashes.
8. Confirm the app is reachable through navigation: `just serve`, then find it
   under `/MAIN/` and via search at `/MAIN/all/`.
9. `just jf <app>` finds the app's justfile from the repository root.

Report the new layout, recipe order, Gum/fallback terminal behavior, routing
behavior, marker changes, and checks performed. Do not commit unless asked; when
asked, make one commit for the one app.

## Rules

- One app per invocation. Stop and ask rather than standardizing extras.
- Exactly one marker per folder.
- Never write deliverables into `tmp/`.
- Do not change behavior, API routes, or user data while standardizing.
