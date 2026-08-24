# cmux1 terminal backend

Routes and pseudo-terminal management for the terminal apps under `Apps/26.8.21-repos/`.

## Files

- `route.ts` exposes the config, font, and WebSocket endpoints.
- `config.ts` holds the public client settings and the login shell.
- `pty.ts` starts, resizes, writes to, and cleans up shell-backed PTYs.
- `.zshenv`, `.zshrc`, and `bashrc` are the opt-in prompt wrappers. Each loads the user's own shell
  config first, then sets Blocks or Arrow from a hook.
- `route_test.ts` covers the routes and loopback-origin checks.
- `pty_test.ts` covers PTY behavior, sizing, and shell output.

## Endpoints

Every route sits under `/api/apps/cmux1`:

- `GET /config` returns the client title and hostname.
- `GET /font` serves a local Nerd Font when one is installed.
- `GET /terminal` upgrades to a WebSocket terminal session.

The server accepts terminal WebSockets only from loopback hosts with a matching origin. Each session
runs `$SHELL`, or `/bin/bash` when `SHELL` is unset, through the system `script` command so the
shell gets a real PTY. The child inherits the parent environment, minus any `NO_COLOR` or
`FORCE_COLOR` it picked up, and advertises true-color support.

The `?prompt=blocks` and `?prompt=arrow` query parameters point the shell at the wrapper rc files:
`--rcfile` for bash, `ZDOTDIR` for zsh. Without one, the shell starts with the user's own prompt.
Blocks is the filled powerline chips. Arrow is the same three fields as colored text and a `❯`.

Moving `ZDOTDIR` also moves `.zshenv`, so the zsh wrapper runs in two stages. `.zshenv` sources the
user's own `.zshenv`, then hands `ZDOTDIR` back to this folder so `.zshrc` still runs. `.zshrc`
restores the user's `ZDOTDIR` (including one their `.zshenv` set), sources their `.zshrc`, and
installs the prompt as a `precmd` hook so a theme that rewrites `PROMPT` each prompt does not
override it. Without the `.zshenv` stage the shell starts with none of the user's environment, and
anything they anchor to `$ZDOTDIR`, history included, lands in this folder.

## Development

Run the repository checks:

```sh
deno task check
```

The main server route registers this backend. It does not run as a separate service.
