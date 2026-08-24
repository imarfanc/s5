# Theming patterns

The goal is that the page follows macOS System Settings → Appearance by default, and that any manual
toggle the repo already has keeps working with "system" as its resting state.

## Why `color-scheme` matters

`prefers-color-scheme` only changes what _your_ CSS does. `color-scheme: light dark` tells the
browser the page supports both, so the UA restyles what you don't control: form controls,
checkboxes, scrollbars, text caret, default canvas. Without it a dark page keeps blinding white
scrollbars and light-mode inputs. Declare it on `:root`; also consider
`<meta name="color-scheme" content="light dark">` so it applies before CSS loads.

## Media-query only (no toggle in the repo)

```css
:root {
  color-scheme: light dark;
  --bg: #ffffff;
  --fg: #1d1d1f;
  --surface: #f5f5f7;
  --border: #d2d2d7;
  --accent: #0071e3;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1e1e1e;
    --fg: #f5f5f7;
    --surface: #2c2c2e;
    --border: #3a3a3c;
    --accent: #0a84ff;
  }
}
body {
  background: var(--bg);
  color: var(--fg);
}
```

Reuse the repo's existing variable names if it has any. A second vocabulary meaning the same thing
is worse than an imperfect existing one.

## Repo already has a class/attribute toggle

Keep the toggle; make absence-of-choice mean "follow the OS". The media query supplies the system
default, explicit attributes override it:

```css
:root {
  color-scheme: light dark;
  --bg: #fff;
  --fg: #1d1d1f;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #1e1e1e;
    --fg: #f5f5f7;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #1e1e1e;
  --fg: #f5f5f7;
}
:root[data-theme="light"] {
  color-scheme: light;
  --bg: #fff;
  --fg: #1d1d1f;
}
```

The `:not([data-theme="light"])` guard is what stops the OS from overriding an explicit user choice
— a common bug when a media query and a toggle are added independently.

JS side: store `"light" | "dark" | "system"`, and for `"system"` remove the attribute entirely
rather than resolving it to a concrete value. That way live OS appearance changes are picked up for
free by the media query.

```js
function applyTheme(pref) { // "light" | "dark" | "system"
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  localStorage.setItem("theme", pref);
}
applyTheme(localStorage.getItem("theme") ?? "system");
```

If the repo's existing toggle is binary, adding a third "System" state is usually the right upgrade
— mention it in the report rather than doing it unasked, since it's a UI change.

## Avoiding the flash

A theme read from localStorage after first paint flashes the wrong appearance. Inline a tiny script
in `<head>`, before stylesheets:

```html
<script>
(function () {
  var t = localStorage.getItem("theme");
  if (t && t !== "system") document.documentElement.setAttribute("data-theme", t);
})();
</script>
```

Pure media-query setups have no flash and need no script.

## Tailwind

Check the config or `@theme` block first.

- `darkMode: 'media'` — already follows the OS. Just verify `color-scheme` is set and that arbitrary
  hex values in class names have `dark:` counterparts.
- `darkMode: 'class'` / `'selector'` — a class toggle; apply the "system default" pattern above by
  seeding the class from `matchMedia('(prefers-color-scheme: dark)')`, and keep a `matchMedia`
  change listener so live OS switches apply.
- Tailwind v4 uses `@custom-variant dark` / `@theme` in CSS rather than a JS config — look in the
  main stylesheet.

Express dark styles as `dark:` variants, not a separate override sheet.

## Things that break in the other appearance

- Raster images/logos with baked-in white backgrounds → provide a dark asset via `<picture>` +
  `media`, or an inline SVG using `currentColor`
- `box-shadow` tuned for light — dark UIs need lighter borders or subtler shadows instead
- Fixed `rgba(0,0,0,.5)` overlays and scrims
- Syntax-highlighting and chart palettes, which usually ship their own light/dark themes
- Very pure `#000` on `#fff` in dark mode — macOS system dark uses near-black (`#1e1e1e`) and
  off-white text; full contrast reads as harsh and causes halation

## Parent shell and iframe themes

Some app browsers copy a same-origin iframe's computed background and accent onto parent chrome.
Treat that as two contracts, not one:

- **Parent chrome follows the OS.** Sidebar text, `color-scheme`, glass tokens, and native controls
  stay on `prefers-color-scheme` / `light-dark()`. Do not set `data-preview-tone` (or equivalent)
  from the iframe's luminance. A dark app next to a light-OS sidebar is correct; a dark app that
  also restyles the sidebar dark while macOS is light is the usual "looks odd" bug.
- **Preview stage may match the child.** Put the iframe's `body`/`html` background on the stage
  behind the iframe (`--preview-bg`), not on the sidebar glass. A background only on an inner `.app`
  or card is invisible to that sync.
- **Accent/tint may be copied onto chrome.** Expose an accent as a concrete computed color. Avoid
  forwarding `var(--accent-500)` when the parent copies the string into a document where that
  variable is undefined.
- After a runtime theme or accent change, notify the parent through its existing event or message
  contract. Initial iframe-load synchronization does not cover later changes.
- Verify parent chrome, stage, and child independently. Record OS appearance, chrome
  `color-scheme`/`--fg`/`--bg`, stage `--preview-bg`, child background/accent, and accent tint on
  chrome. If the OS is light and the child is dark, chrome must stay light.

### Composed custom properties resolve in their declaration context

A custom property that composes other custom properties can retain values from the ancestor where it
is declared:

```css
:root {
  --glass: linear-gradient(rgb(255 255 255 / .7), rgb(255 255 255 / .5));
  --composed-bg: var(--image), var(--glass);
}
body[data-tone="dark"] {
  --glass: linear-gradient(rgb(255 255 255 / .07), rgb(255 255 255 / .02));
}
.sidebar {
  background-image: var(--composed-bg);
}
```

Do not assume the descendant's `--glass` override changes an inherited composition. Redeclare the
composition at the same scope as the override, or compose the layers directly at the consuming rule:

```css
body[data-tone="dark"] {
  --glass: linear-gradient(rgb(255 255 255 / .07), rgb(255 255 255 / .02));
  --composed-bg: var(--image), var(--glass);
}
```

Inspect `getComputedStyle()` for both the leaf token and the composed property. Seeing the correct
leaf value is insufficient if the rendered background still contains the ancestor's light-mode
layer.

## Contrast

Keep body text at 4.5:1 against its background and large text/UI at 3:1 **in both appearances**.
It's easy to satisfy in light and fail in dark. Check the pairs you introduce.
