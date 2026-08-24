# cmux1

A local multi-terminal workspace. Every session in the rail is a real shell on this machine, and
the rail shows what each one is doing without you switching to it.

## Files

- `index.html` is the whole frontend: rail, terminal panes, and settings.
- `_app.yaml` holds the metadata the sites5 sidebar reads.
- `favicon.svg` is the app icon.

The frontend loads the vendored terminal assets from `/apps/_shared/1-repos/` and talks to the
backend in `backends/apps/1-repos/route.ts`.

## Backend endpoints

- `GET /api/apps/1-repos/config` returns client configuration and the hostname.
- `GET /api/apps/1-repos/font` serves the terminal font.
- `GET /api/apps/1-repos/terminal` upgrades to a WebSocket terminal session.

Each terminal runs the configured login shell, falling back to `/bin/bash`. Run the site with
`deno task dev` and open `/apps/26.8.21-repos/cmux1/`.

## The rail

A dot next to each session brightens the moment bytes arrive and fades over about a second, so you
can see which shells are working. Under the name is the last line that shell printed. `⌘T` opens a
terminal, `⌘1` through `⌘9` switch between them, and closing a session ends the shell.

## Settings

The gear button at the bottom of the rail opens settings. Choices are stored in
`localStorage` under `cmux1.settings.v1`.

**Sidebar labels.** Plain shows the session name as text. Blocks draws it as a powerline strip: the
left block turns phosphor while that shell is producing output, and the name block turns amber when
the session is selected and maroon once the shell exits. Both options preview the real thing, drawn
by the same renderer the rail uses.

**Prompt style.** Native leaves your shell prompt alone. Blocks wraps it in the powerline prompt
from `bashrc` / `.zshrc` in the backend folder, which sources your normal shell config first. The
change reaches terminals you open next, not ones already running.

**Filename colors.** Tints filenames in output that arrives without ANSI color of its own.

**Type.** Font face, size (10 to 20px), and leading (1.0 to 2.0). Changes apply to every open
terminal at once.

Reset returns Plain labels, the Native prompt, filename colors off, and 12px at 1.0 leading.

WebSocket access stays same-origin. The standalone source's cross-port loopback CORS mode is off
here on purpose, since this app runs inside the authenticated sites5 host.
