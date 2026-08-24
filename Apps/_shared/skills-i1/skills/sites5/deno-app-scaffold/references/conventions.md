# Conventions

Contents:

1. [Repository layout](#repository-layout)
2. [The task set](#the-task-set)
3. [Config ownership](#config-ownership)
4. [Terminal styling API](#terminal-styling-api)
5. [The chooser](#the-chooser)
6. [The serve supervisor](#the-serve-supervisor)
7. [Docs](#docs)
8. [Common drift to look for](#common-drift-to-look-for)

## Repository layout

```
my-app/
├── deno.json              tasks, imports, fmt/lint config
├── AGENTS.md              how contributors and agents work here
├── README.md              what it is, how to run it
├── src/                   the application
│   ├── main.ts            entrypoint; reads PORT, owns shutdown
│   ├── config.ts          application settings
│   └── tests/             all tests, imported with ../
├── public/                static assets served as-is (server apps only)
└── _other/
    ├── scripts/           the developer surface
    └── git/               generated Markdown, excluded from fmt/lint
```

Tests live in `src/tests/`, not beside the modules they test. One directory to point CI at, and
`src/` stays a list of the app's real modules.

`_other/` is the non-application material. The leading underscore sorts it out of the way and
signals "this is not the product."

## The task set

Every repo has the same core vocabulary, so switching between them costs nothing:

| Task          | Meaning                                                   |
| ------------- | --------------------------------------------------------- |
| `choose`      | Interactive picker for everything below                    |
| `dev`         | Run with file watching                                     |
| `start`       | Run once                                                   |
| `test`        | Tests only                                                 |
| `check`       | `deno fmt --check && deno lint && deno check <entry> && deno test -A` |
| `git:history` | Regenerate `_other/git/*.md` from Git                      |

`check` is the handoff gate. Keep it a single command that a contributor or agent can run without
thinking, and keep it fast enough that they actually will.

Add app-specific tasks freely, but add them in two places at once: `deno.json` and the `TASKS` array
in `_other/scripts/choose-lib.ts`. Group them under `run`, `check`, or `repo` — or add a group if
the app genuinely has another category.

## Config ownership

Two config modules, with a deliberate boundary between them:

- `src/config.ts` — application settings. Export a `clientConfig` object for anything the browser is
  allowed to see, then spread it into `config` and add server-only fields:

  ```ts
  export const clientConfig = { title: "My App", favicon: "/favicon.svg" };
  export const config = { ...clientConfig, dataRoot: new URL("../data/", import.meta.url) };
  ```

  The handler then serves `clientConfig` directly instead of hand-picking fields, so adding a client
  setting is a one-line change in one file.

- `_other/scripts/config.ts` — what the developer scripts need: title, repo root, port, base URL,
  entrypoint, watch paths, tool paths.

The port lives only in `_other/scripts/config.ts`. `serve.ts` passes it to the child as `PORT` via
the command's `env`, and `src/main.ts` reads `Deno.env.get("PORT")` with a fallback that only
matters when someone runs `src/main.ts` directly. If you find yourself writing the same number in
both files, you have reintroduced the bug this layout exists to prevent.

The scripts do not import from `src/`. If the scripts and the app genuinely need the same value,
have the launcher pass it through the environment rather than reaching across the boundary.

## Terminal styling API

`_other/scripts/style.ts` is the only file that writes ANSI escapes. It exports:

**Colour and weight**: `bold`, `dim`, `italic`, `underline`, `inverse`, `accent`, `success`,
`warning`, `danger`, `muted`. Colour is on for terminals unless `NO_COLOR` is set — handled once,
in `colorEnabled`, so no individual script has to remember.

**Messages**: `info(text)`, `ok(text)`, `warn(text)`, `error(text)`, `fail(text)` (which exits 1),
plus the `labels` record if you need the badge without the newline. Labels are padded to a common
width so consecutive lines align. `errorMessage(value)` narrows an `unknown` catch to a string.

**Layout**: `displayWidth` (counts terminal columns, ignoring escape sequences and counting emoji as
two cells), `padDisplay`, `rule(title, width)` for `── RUN ──────` section headers, `hint(key, text)`
and `hints(...)` for footer key legends, `hyperlink(url)` for OSC 8 links.

**Screen and box**: the `screen` record (`clear`, `hideCursor`, `showCursor`, `mouseOn`, `mouseOff`,
`column(n)`) and `boxTop` / `boxDivider` / `boxBottom` / the `box` glyph record.

Naming rule: helpers are named for meaning, not appearance — `hint` and `rule`, not `yellowText`.
That way a later theme change is one edit here rather than a repo-wide search for the color you
meant.

Two details worth preserving because they are easy to get wrong and annoying to debug:

- `displayWidth` strips escape sequences before measuring. Padding colored strings by
  `String.length` silently over-pads by however many bytes the escapes took.
- Regexes over control characters are built with `String.fromCharCode(27)` rather than `\x1b`
  literals, because `deno lint`'s `no-control-regex` rule rejects the literal form.

## The chooser

`choose.ts` renders the task list; `choose-lib.ts` holds the pure logic (task table, row building,
mouse parsing, selection clamping) so it stays testable and the renderer stays a renderer.

Rows are a tagged union — `spacer`, `heading`, `task` — and screen-row-to-task mapping goes through
`taskIndexAtScreenRow(rows, screenRow, FIRST_ROW)`. Because spacers are real entries in the rows
array, adding visual breathing room never desynchronizes mouse clicks. If you change the header
height, update `FIRST_ROW` in `choose.ts` and nothing else.

Interaction: `↑/↓` or `j/k` move, number keys run directly, `enter` runs the selection, a click
selects and a second click on the selected row runs it, the wheel scrolls, `q`/`esc`/`Ctrl+C`
cancels. Raw mode and mouse reporting are always restored in a `finally` block — a script that exits
leaving the terminal in raw mode is a genuinely bad experience.

`deno task choose <name>` skips the UI entirely, which is what non-interactive callers and agents
should use.

## The serve supervisor

`serve.ts` spawns the app as a child process, prints the banner, and owns the hotkeys: `b` default
browser, `h` Helium, `a` Helium app mode, `x` stop. `Ctrl+C` and `Ctrl+D` stop it too.

Shutdown is graceful then forceful: `SIGINT` to the child, wait up to 750 ms, then `SIGKILL`.
Terminal raw mode is restored on every exit path.

The banner positions its columns with absolute cursor moves (`screen.column(n)`) rather than string
padding, because icon and emoji widths vary by terminal and font. When stdout is not a terminal it
falls back to plain padded text, so piping the output to a file still produces something readable.

Rows show URL, port, mode, and terminal, then the hotkey legend. Showing the port explicitly next to
the URL is worth the line — it is the value people actually need when something else has taken 8000.

## Docs

- `AGENTS.md` — the working agreement: run `deno task check` before handoff, where things live, the
  conventions that are easy to violate. Keep it short enough to be read.
- `README.md` — what the app is, how to run it, the task table, the hotkeys.
- `_other/scripts/README.md` — one line per script, so someone can find the right file without
  opening all of them.

Update these in the same change that alters behavior. A task table that lists a task that no longer
exists trains people to stop trusting the docs.

## Common drift to look for

- The same port, title, or path literal in two files.
- Raw `\x1b[` escapes in a script that could have used `style.ts`.
- A `deno.json` task with no `TASKS` entry, or vice versa.
- Tests that migrated back next to their modules instead of `src/tests/`.
- `check` growing slow enough that people skip it, or narrow enough that it stops catching anything.
- Generated output (`_other/git/`) not excluded from `fmt` and `lint`, so `check` fails on files
  nobody hand-edits.
