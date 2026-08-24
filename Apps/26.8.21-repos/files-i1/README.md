# files-i1

Pick a folder under `$HOME`, then run search, find, tree, space, and junk cleanup against it. Destructive actions scan first, then move selected paths to Trash.

Needs host binaries: `rg`, `fd`, `fzf`, `tree`, `tldr`, and optionally `trash` (`brew install trash`). Missing tools show as disabled with the install line.

The backend lives at `backends/apps/files-i1/` and is registered in `backends/routes/router.ts`. Restart the dev server after adding the app.
