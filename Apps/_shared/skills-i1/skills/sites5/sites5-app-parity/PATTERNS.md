# sites5 app parity patterns

Copyable pieces for the Tier 3 features in [SKILL.md](SKILL.md). These are
shapes, not drop-in code: `<app>` stands for the app's `store:` value,
`<item>` for whatever the app calls its rows, and every id and label needs
renaming for the app you are building. Pasting a snippet unchanged is the
fastest way to end up with two apps fighting over the same localStorage key.

The real source of truth is a working app in the repo. Pick the closest one
(see the reference-app step in SKILL.md), read its entry file, and use these
snippets to understand *why* it is written that way rather than as a
substitute for reading it.

## Tokens

```css
:root {
  color-scheme: light dark;
  --page: #f0f4f7;
  --accent: #1e4d6b; /* same hex as _app.yaml color: */
  --accent-hover: color-mix(in srgb, var(--accent) 82%, black);
  --accent-text-on-dark: #ffffff;
  --accent-text-on-light: #071018;
  --accent-text: var(--accent-text-on-dark);
  --scrim: rgb(0 0 0 / 42%);
}
@media (prefers-color-scheme: dark) {
  :root {
    --accent-hover: color-mix(in srgb, var(--accent) 82%, white);
    --accent-text: var(--accent-text-on-light);
  }
}
#help, #item-modal { background: var(--scrim); }
body {
  background-color: var(--page);
  background-image: var(--cover);
  background-position: center;
  background-size: cover;
  background-attachment: fixed;
}
```

Tell the shell after any runtime accent or background change:

```js
function tellShell() {
  try { parent.postMessage({ type: "gallery-preview-bg-changed" }, "*"); } catch { /* not framed */ }
}
```

## Persisted view and mode

```js
const VIEW_KEY = "<app>.view";
const MODE_KEY = "<app>.mode";
const VIEWS = ["list", "grid"];
const VIEW_LABEL = { list: "list", grid: "cards" };
const MODES = ["normal", "zen", "edit"];

function readView() {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved && VIEWS.includes(saved)) return saved;
  } catch { /* private mode */ }
  return VIEWS[0];
}

function setView(next) {
  if (!VIEWS.includes(next)) next = VIEWS[0];
  view = next;
  document.body.dataset.view = view;
  try { localStorage.setItem(VIEW_KEY, view); } catch { /* private mode */ }
  render();
}

function cycleView() {
  const i = VIEWS.indexOf(view);
  setView(VIEWS[(i + 1) % VIEWS.length]);
}

function setMode(next) {
  if (!MODES.includes(next)) next = MODES[0];
  mode = next;
  document.body.classList.toggle("edit", mode === "edit");
  document.body.classList.toggle("zen", mode === "zen");
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* private mode */ }
}

function cycleMode() {
  const i = MODES.indexOf(mode);
  setMode(MODES[(i + 1) % MODES.length]);
}
```

Drive layout from `body[data-view="grid"]` and chrome from `body.zen` /
`body.edit`. Append to `VIEWS` or `MODES` rather than branching on booleans.

## One modal, three kinds

Markup: one `role="dialog"` with a textarea, a read-only view node, and
three action buttons. Chrome is a function of `modalKind`.

```js
function syncModalChrome() {
  const viewing = modalKind === "view";
  input.hidden = viewing;
  itemView.hidden = !viewing;
  modalCopy.hidden = !viewing;

  if (modalKind === "new") {
    modalTitle.textContent = "New item";
    modalMeta.hidden = true;
    modalSecondary.textContent = "Cancel";
    modalPrimary.textContent = "Add";
  } else if (modalKind === "edit") {
    modalTitle.textContent = "Edit item";
    modalSecondary.textContent = "Cancel";
    modalPrimary.textContent = "Save";
  } else {
    modalTitle.textContent = "Item";
    modalSecondary.textContent = "Close";
    modalPrimary.textContent = "Edit";
  }
}

function openItemModal(kind, item = null) {
  modalKind = kind;
  modalItem = item;
  editingId = item?.id ?? null;
  if (kind === "view") setMultiline(itemView, item?.text ?? "");
  input.value = item?.text ?? "";
  syncModalChrome();
  dialog.hidden = false;
  if (kind === "view") modalSecondary.focus();
  else {
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }
}
```

Primary in view mode opens edit on the same dialog. Cmd/Ctrl+Enter saves
from the textarea. Click on the scrim (the dialog itself, not the sheet)
closes.

## Viewport-clamped context menu

```html
<div id="item-menu" hidden role="menu" aria-label="Item actions">
  <button type="button" role="menuitem" data-action="copy">Copy</button>
  <button type="button" role="menuitem" data-action="view">View</button>
  <button type="button" role="menuitem" data-action="edit">Edit</button>
  <button type="button" role="menuitem" data-action="delete" class="danger">Delete</button>
</div>
```

```js
function openItemMenu(event, item, row) {
  event.preventDefault();
  menu.hidden = false;
  menu.style.left = "0px";
  menu.style.top = "0px";
  const pad = 8;
  const rect = menu.getBoundingClientRect();
  let left = event.clientX;
  let top = event.clientY;
  if (left + rect.width > innerWidth - pad) left = innerWidth - rect.width - pad;
  if (top + rect.height > innerHeight - pad) top = innerHeight - rect.height - pad;
  if (left < pad) left = pad;
  if (top < pad) top = pad;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}
```

Close on pointerdown outside, scroll (capture), resize, and Escape. Reset
the delete menuitem's confirm state on close.

## Two-step delete

On first click, add `.confirm`, change the label to `Confirm?`, and set
`aria-label` to `Confirm delete: <title>`. Reset every other confirm
button in the list first. Second click runs the delete query. Store the
original label in `dataset.label` so cancel can restore it.

```js
remove.setAttribute("aria-label", `Delete item: ${title.slice(0, 40)}`);
remove.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!remove.classList.contains("confirm")) {
    for (const other of list.querySelectorAll(".item-delete.confirm")) {
      if (other === remove) continue;
      other.classList.remove("confirm");
      other.textContent = "Delete";
      other.setAttribute("aria-label", other.dataset.label || "Delete item");
    }
    remove.dataset.label = `Delete item: ${title.slice(0, 40)}`;
    remove.classList.add("confirm");
    remove.textContent = "Confirm?";
    remove.setAttribute("aria-label", `Confirm delete: ${title.slice(0, 40)}`);
    return;
  }
  act(() => items.run("deleteItem", [item.id]));
});
```

Do not put an anonymous wrapper around title/preview/meta. Append them
straight onto the `<li>` so grid `preview { flex: 1 }` actually fills.

## Help sheet and shortcuts

Help is another `role="dialog"`. Each shortcut row has
`<kbd data-key="v">v</kbd>`. Ignore keys while focus is in an input,
textarea, select, or contenteditable, and while meta/ctrl/alt are held.

```js
function typingInField(target) {
  return target instanceof HTMLElement &&
    (target.matches("input, textarea, select") || target.isContentEditable);
}

function flashHelpKey(key) {
  if (help.hidden) return;
  const kbd = help.querySelector(`kbd[data-key="${key}"]`);
  if (!kbd) return;
  kbd.classList.add("pressed");
  clearTimeout(kbd._pressTimer);
  kbd._pressTimer = setTimeout(() => kbd.classList.remove("pressed"), 200);
}

function runWithHelpFlash(key, action, { keepHelp = true } = {}) {
  flashHelpKey(key);
  if (keepHelp || help.hidden) {
    action();
    return;
  }
  setTimeout(action, 160);
}
```

A workable binding set: `e` cycle mode, `z` toggle zen, `v` cycle view,
`n` new item, `/` toggle help, Escape closes menu, then modal, then help,
then returns to normal mode. Keep whatever the reference app already uses so
muscle memory carries between apps in the gallery.

## Cover-sampled accent

```js
async function accentFrom(url) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  let best = null;
  let bestScore = -1;
  let ar = 0, ag = 0, ab = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const sat = max === 0 ? 0 : (max - min) / max;
    if (lum > 35 && lum < 220) {
      ar += r; ag += g; ab += b; n++;
      const score = sat * (1 - Math.abs(lum - 128) / 128);
      if (score > bestScore) {
        bestScore = score;
        best = [r, g, b];
      }
    }
  }
  const [r, g, b] = best ?? (n ? [ar / n, ag / n, ab / n] : [30, 77, 107]);
  const accent = hex(r, g, b);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const root = document.documentElement.style;
  root.setProperty("--accent", accent);
  root.setProperty(
    "--accent-text",
    lum > 160 ? "var(--accent-text-on-light)" : "var(--accent-text-on-dark)",
  );
  tellShell();
}
```

Pick the most saturated pixel near mid-luminance. Fall back to the
mid-tone average, then to the `_app.yaml` color. CORS failures should
`.catch` and still `tellShell()`. Cycle covers with `<app>.cover` in
localStorage the same try/catch way as view and mode.

`_app.yaml` `color:` stays the static fallback so the sidebar icon is
right before the iframe loads.

## Copy with toast

```js
async function copyText(text, row) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.append(ta);
    ta.select();
    try {
      if (!document.execCommand("copy")) throw new Error("copy failed");
    } finally {
      ta.remove();
    }
  }
  showCopyToast(row);
}
```

Toast is a `role="status"` node appended to the row, shown with a rAF
class, removed after ~1.4s. Clipboard API first; textarea fallback for
when the API is blocked.

## Database talk

```js
import { db } from "/shared/db.js";
const items = db();
await items.run("addItem", ["milk"]);
const rows = await items.rows("listItems");
```

After a write, re-read the list. Rows live on the server. Patching a
local copy is both more code and wrong when another tab edited the same
table.

```js
async function act(write) {
  try {
    setStatus("Loading…");
    if (write) await write();
    rows = await items.rows("listItems");
    render();
  } catch (error) {
    setStatus(error.message || "Could not reach the database.", true);
  }
}
```

## Host toolkit (`files-i1` shape)

Use this when the app is a rail of host commands, not a notes list. The
working copy is `Apps/26.8.21-repos/files-i1/` plus
`backends/apps/files-i1/`. Read those; do not paste this as a second
implementation.

```
Layout
- left rail of tools grouped by FIND / CLEAN / ANALYZE / REFERENCE / HOST
- path tape + folder picker (browse from $HOME, typed path, recents)
- one form row: grow the query, compact the rest, Run on the right
- #ran between the form and the banner, showing the argv as you type
- pre.output for command text (ANSI painted, copy stripped)
```

```js
const API = "/api/apps/<id>";

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    cache: "no-store",
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || response.statusText);
  return body;
}
```

Health on load. Store `{ bin: boolean, brew: string }` per tool. Disable
the rail button when `bin` is false. Recheck is a button on the Host page,
not a masthead that fights the path tape.

Return `command` from every mutating or listing handler. Mirror it in the
client while the user types so Run is not a surprise. Tick banners that
end in `…` (`Working… 0s`). Never bind input to submit for `fzf --filter`
or `rg`. That sat at forty seconds of "Working…" because each keystroke
started another process.

```css
pre.output {
  font: 12.5px/1 var(--output);
  font-variant-ligatures: none;
  white-space: pre-wrap;
}
```

`--output` is a loaded mono (IBM Plex Mono), not `ui-monospace`. Tree
colour is `tree -C` plus `CLICOLOR_FORCE` on the server. tldr is
`tldr --color <name>` with `NO_COLOR` unset; `--color=never` is a
different flag on some CLIs.

Picker errors go next to the picker, not the hidden page banner. Trash
only paths from the immediately preceding scan. `$HOME` itself is not a
trash target.
