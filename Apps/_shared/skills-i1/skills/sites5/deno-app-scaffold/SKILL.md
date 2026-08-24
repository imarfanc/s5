---
name: deno-app-scaffold
description: Scaffold and maintain Deno applications with a consistent house style — a `deno task` set driven by an interactive chooser, a supervisor that prints a boxed startup banner and owns browser hotkeys, one shared terminal-styling module instead of scattered ANSI escapes, and a strict `_other/scripts` vs `src` layering rule. Use this whenever the user starts a new Deno app, project, CLI, or server; asks to add tasks, a task picker, a dev/start supervisor, or repo utilities to an existing Deno repo; wants a new app to "look like" or "match" an existing one of theirs; or is writing terminal output, banners, spinners, pickers, or colored CLI output in a Deno project. Also use it when reviewing or cleaning up a Deno repo's structure, task list, config duplication, or script styling — even if the user does not mention scaffolding, conventions, or this skill by name.
---

# Deno app scaffold

This skill carries one repository's house style into new Deno apps: how tasks are named and
discovered, how the dev server is supervised, how terminal output is styled, and where
configuration is allowed to live. The point is that someone who knows one of these repos can sit
down in front of another and already know what `deno task choose` will show them.

Everything here is Deno-native with no build step, no bundler, and no `node_modules`.

## Start by understanding which situation you are in

**Creating a new app.** Copy the template, rename, then delete what the app does not need. Details
below.

**Adding these conventions to an existing repo.** Do not overwrite the app. Copy only
`_other/scripts/` and merge the task list into the existing `deno.json`. Read the existing code
first and adapt the templates to it — for example, if the repo already has a config module, wire
`_other/scripts/config.ts` alongside it rather than duplicating values.

**Reviewing a repo that already follows this style.** Read `references/conventions.md` and check the
repo against it. The most common drift is a setting defined in two places and raw ANSI escapes
creeping back into individual scripts.

## Scaffolding a new app

1. Copy the template into the target directory:

   ```bash
   cp -r <skill-path>/assets/template/. <target-dir>/
   ```

2. Replace the `{{APP_NAME}}` token everywhere:

   ```bash
   cd <target-dir> && grep -rl '{{APP_NAME}}' . | xargs sed -i 's/{{APP_NAME}}/My App/g'
   ```

   (On macOS, `sed -i ''` instead of `sed -i`.)

3. Subtract what the app does not need. The template is a small HTTP server because that is the
   common case, but the conventions are not about serving:
   - **Pure CLI, no server**: delete `_other/scripts/serve.ts`, `src/server.ts`, `public/`, and the
     `dev` and `start` tasks; point `src/main.ts` at the CLI entry and give `choose.ts` the tasks
     that actually exist.
   - **No Git history docs**: delete `git-history.ts` and its task.
   - Whatever survives, `deno task choose` must list exactly the tasks in `deno.json`. A chooser
     offering a task that does not exist is worse than no chooser.

4. Add the app's real dependencies to `deno.json` `imports`, then run `deno task check`. It should
   pass on a freshly scaffolded repo before you write any application code — that gives you a known
   good baseline to work from.

5. Build the actual application in `src/`, with tests in `src/tests/`.

## The parts and why they exist

Read `references/conventions.md` for the full rules with examples. The short version:

**`_other/scripts/` is the developer surface.** Everything a person types after `deno task` lives
here, and none of it imports from `src/`. That boundary is what lets the app be rewritten without
breaking the developer's muscle memory, and it keeps the launcher runnable even when `src/` does not
compile.

**One source of truth per setting.** `_other/scripts/config.ts` owns the port; `serve.ts` passes it
to the server as `PORT`, and the fallback in `src/main.ts` only applies when someone runs that file
directly. A value duplicated in two files will drift, and a port that drifts silently opens the
wrong URL. Apply the same reasoning to any new setting: decide who owns it and have everyone else
receive it.

**`style.ts` is the only place ANSI escapes are written.** Scripts call `accent`, `muted`, `warn`,
`hint`, `boxTop` and so on. This is not fussiness — when each script rolls its own colors, `error`
means red here and bold there, and `NO_COLOR` support is remembered in some files and forgotten in
others. Centralizing it also means `displayWidth` correctly ignores escape sequences when aligning
columns, which hand-rolled padding always gets wrong.

**The chooser is the front door.** `deno task choose` shows grouped tasks with keyboard, number-key,
and mouse support. New tasks go in `choose-lib.ts`'s `TASKS` array and in `deno.json` together.

**The banner tells you what you launched.** `serve.ts` prints a boxed table with the URL (as an
OSC 8 hyperlink so cmd-click works), port, mode, and hotkeys. It positions columns using terminal
cursor moves rather than guessing emoji widths, which is why the table stays aligned with icons in
it.

## Extending the conventions

When you add something new, ask which of these it belongs to. A new repo utility (a release script,
a data importer) is `_other/scripts/` plus a `deno.json` task plus a `TASKS` entry. A new setting
belongs to whichever config already owns that concern. New terminal output uses existing `style.ts`
helpers; only add a helper there if two scripts would otherwise duplicate it, and give it a
semantic name (`hint`, `rule`) rather than a color name (`makeYellow`).

Keep `deno task check` green as you go. It is the single command the AGENTS.md tells every
contributor to run, so it has to stay fast and meaningful.

## Files in this skill

- `assets/template/` — the complete working scaffold. It passes `deno task check` as-is.
- `references/conventions.md` — the rules with rationale and examples: task set, layering, config
  ownership, styling API, chooser and banner mechanics.
