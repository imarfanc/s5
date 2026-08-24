# {{APP_NAME}}

```bash
deno task choose   # pick a task from the menu
deno task dev      # run with file watching
```

Open <http://localhost:8000>. Application settings live in `src/config.ts`; the port lives in
`_other/scripts/config.ts` and is passed to the server as `PORT`. Tests live in `src/tests/`.

## Tasks

| Task          | What it does                               |
| ------------- | ------------------------------------------ |
| `choose`      | Interactive picker for the tasks below     |
| `dev`         | Run with file watching and browser hotkeys |
| `start`       | Run once with browser hotkeys              |
| `check`       | Format-check, lint, type-check, and test   |
| `test`        | Tests only                                 |
| `git:history` | Write Markdown files from Git history      |

While `dev` or `start` is running, press `b` to open the app in your browser, `h` for Helium, `a`
for Helium app mode, and `x` to stop.
