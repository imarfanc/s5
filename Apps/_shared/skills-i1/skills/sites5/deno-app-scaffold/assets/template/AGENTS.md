# {{APP_NAME}}

Deno-native, no build step. Run `deno task check` before handing off changes — it covers formatting,
linting, type-checking, and tests in one command.

## Layout

- `src/` is the application. `src/tests/` holds its tests.
- `_other/scripts/` is the developer surface: the task chooser, the server supervisor, and repo
  utilities. These deliberately do not import from `src/`, so the two sides can move independently.
- `src/config.ts` holds application settings. `_other/scripts/config.ts` holds the settings the
  scripts need, including the port, which lives there and nowhere else.

## Conventions

- One source of truth per setting. If a value appears in two files, one of them should import it or
  be handed it — a port that drifts between the launcher and the server is a real bug.
- Terminal output goes through `_other/scripts/style.ts`. Reach for `accent`, `muted`, `warn`, and
  friends rather than writing raw ANSI escapes, so every script reads as the same program.
- Keep the HTML and generated DOM shallow. Avoid wrapper elements that add nodes without improving
  semantics or accessibility, and preserve stable, descriptive IDs on major elements.
