# Repository scripts

Standalone repository utilities. They deliberately do not import from the application folders, so
`_other/` can be copied into any Deno repository as-is: nothing here is hardcoded to one project.

## Dropping `_other/` into another repo

1. Copy the `_other/` folder in.
2. Add the tasks you want to that repo's `deno.json`:

```jsonc
"choose": "deno run -A _other/scripts/choose.ts",
"dev": "deno run -A _other/scripts/serve.ts dev",
"start": "deno run -A _other/scripts/serve.ts start",
"git:history": "deno run -A _other/scripts/git-history.ts",
"icons": "deno run -A _other/scripts/build-icons.ts"
```

That is the whole setup. The title comes from the repository folder name, the entrypoint and watch
paths are detected from what exists on disk, and the picker reads the host repo's own tasks. Only
when detection guesses wrong do you set anything, in the `OVERRIDES` object at the top of
`config.ts`.

## The files

- `config.ts` — the shared settings: title, repository root, port, base URL, entrypoint, watch
  paths, and the Helium path. `serve.ts` owns the port and passes it to the server as `PORT`; the
  entrypoint's own fallback only applies when that file is run directly. `OVERRIDES` at the top is
  the one place to pin a value that detection gets wrong.
- `style.ts` — shared terminal styling: one palette, message labels (`info`, `ok`, `warn`, `error`,
  `fail`), screen and cursor escapes, box drawing, and display-width helpers. Scripts should use
  these rather than raw ANSI codes.
- `choose-lib.ts` — reads the task list out of the host repo's `deno.json` or `deno.jsonc`, sorts it
  into run, check, and repo groups, and holds the picker's geometry and mouse parsing.
- `choose.ts` — presents those tasks. Keyboard navigation, mouse-wheel movement, and
  click-to-select/click-again-to-run.
- `serve.ts` — supervises both `dev` and `start`, prints the startup table, and owns the browser,
  clipboard, and shutdown hotkeys. `HOTKEYS` is the single list behind the help text, the banner,
  and the key loop.
- `git-history.ts` — writes `git-history.md` and `git-messages.md` into `_other/git` directly from
  Git.
- `build-icons.ts` — scans the repo for Iconify names such as `lucide:house`, fetches just those
  icons, and writes one committed SVG sprite so the site needs no icon CDN. Output path comes from
  `config.iconSprite`.
- `icons.ts` — single-cell Nerd Font glyphs for the serve banner.

Run the chooser with `deno task choose`. A task can also be selected without the UI, for example
`deno task choose check`.
