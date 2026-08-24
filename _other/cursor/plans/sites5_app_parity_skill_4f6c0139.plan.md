---
name: sites5 app parity skill
overview: Create a personal skill, `sites5-app-parity`, holding a tiered checklist (required baseline vs optional UX features) derived from everything done for the notes-notes app, so future sites5 apps are built to the same standard.
todos:
  - id: skill-md
    content: Write ~/.cursor/skills/sites5-app-parity/SKILL.md with frontmatter and the three-tier checklist
    status: completed
  - id: patterns-md
    content: Write PATTERNS.md with snippets for the Tier 3 UX features
    status: completed
  - id: verify
    content: Verify SKILL.md is under 500 lines, description is third-person with trigger terms, and references are one level deep
    status: completed
isProject: false
---

# sites5 app parity skill

A personal skill at `~/.cursor/skills/sites5-app-parity/` that turns the notes-notes build into a
reusable, tiered checklist. Two files: the checklist itself, and a patterns reference for the fiddly
UX code so `SKILL.md` stays short.

## Files

- `~/.cursor/skills/sites5-app-parity/SKILL.md` — frontmatter (`name`, `description`,
  `disable-model-invocation: true`) plus the tiered checklist.
- `~/.cursor/skills/sites5-app-parity/PATTERNS.md` — copyable snippets for the optional features, so
  the checklist can stay one line per item.

## Tier 1 — Required baseline

Every item here was load-bearing in notes-notes and is enforced by the repo or the shell.

- Folder `Apps/<appspace>/<name>/` with `_app.yaml` copied from
  `Apps/_templates/_app.template.yaml`; set `name`, `sort_name`, `description`, `updated`, `icon`,
  `color`, `appspace`, `sections`, `tags`, `entry`.
- Set `store:` explicitly (a folder rename must not orphan data). Add `db: v1` only if the app needs
  rows.
- If it has a database: `schema.sql` declares every `{token}` table, index named after its token
  (`{notes}_created`), `queries.sql` holds one named statement per operation. Browser sends names,
  never SQL.
- Talk to it through `/shared/db.js` (`db()`, `.run()`, `.rows()`) or `/shared/store.js` — no
  backend code per app.
- Theme contract, all three: `:root { --accent }` in the app, the same hex in `_app.yaml` `color:`,
  page background on `body` not an inner card.
- `color-scheme: light dark` on `:root`, tokenized surfaces, one
  `@media (prefers-color-scheme: dark)` override. No second theme mechanism, no class or
  `data-theme` toggle.
- Restart the dev server after touching `_app.yaml`, `schema.sql`, or `queries.sql` — all three are
  cached for the process lifetime.
- New Iconify name anywhere → `deno task icons`.
- `deno task manifest`, then `deno task check` (it fails on a stale manifest).

## Tier 2 — Recommended (parity items)

Things notes-notes has that a new app should consciously accept or decline.

- Every landmark and interactive element carries a stable `id` (`notes-main`, `notes-title`,
  `notes-intro`, `notes-hint`, `note-modal-sheet`, `help-sheet`, modal action buttons). Generated
  rows use `data-<thing>-id`, never loop-generated ids.
- Flat markup: no anonymous wrapper `div` inside list items — put `title` / `preview` / `meta`
  straight on the `<li>` so flex rules actually apply.
- Dialogs get `role="dialog" aria-modal="true" aria-labelledby`; live region gets `role="status"`;
  context menus get `role="menu"` / `role="menuitem"`; destructive buttons get a descriptive
  `aria-label`.
- `--scrim` token for overlays rather than a repeated `rgb(0 0 0 / 42%)`.
- Accent text tokens named for their surface (`--accent-text-on-dark`, `--accent-text-on-light`) so
  CSS and JS share one source.
- `parent.postMessage({ type: "gallery-preview-bg-changed" }, "*")` whenever accent or background
  changes at runtime, wrapped in `try/catch` for the unframed case.
- All `localStorage` reads and writes wrapped in `try/catch` (private mode).
- A DOM and theme audit note in `_other/docs/dom-theme-audit-<app>.md` with an "Applied" section
  recording what was taken and what was skipped.

## Tier 3 — Optional UX features

Marked clearly as a menu, not a mandate; details in `PATTERNS.md`.

- Persisted view cycling (`list` / `grid`) and mode cycling (`normal` / `zen` / `edit`) behind
  `<APP>.view` / `<APP>.mode` keys.
- Modal that serves new / edit / view from one element, with chrome synced by a single
  `syncModalChrome()`.
- Right-click context menu with viewport-clamped positioning.
- Two-step inline delete confirmation that resets sibling buttons and restores `aria-label`.
- Keyboard shortcuts with a `/` help sheet that flashes the matching `kbd`.
- Cover image with canvas-sampled accent, picking the most saturated mid-luminance pixel and
  choosing accent text by luminance.
- Copy to clipboard with a status flash.

## Verification

The skill closes with the same loop used here: `deno task check`, grep that touched selectors still
match markup, then manual passes in list and grid, light and dark OS appearance, and each modal
state.
