---
name: dom-theme-tuneup
description: Audit and clean up a web repo's frontend — flatten unnecessarily deep or redundant DOM nesting, add stable `id` attributes to major structural and interactive elements, and make styles respect the OS light/dark appearance (macOS Appearance / prefers-color-scheme), adapting the repo's existing theme system rather than replacing it. Produces a findings report first, then applies changes only after the user approves, verifying with the repo's own build/typecheck/tests and a diff review. Use this skill whenever the user mentions DOM depth, "div soup", wrapper divs, simplifying or flattening markup, adding ids/hooks/selectors to elements, dark mode, light mode, system appearance, prefers-color-scheme, theming a site, or asks to "clean up", "tidy", "audit", or "modernize" the HTML/CSS/JS/TS of a repo or page — even when they don't name all three concerns.
---

# DOM & Theme Tuneup

Three related cleanups on one frontend codebase: shallower DOM, stable ids, and OS-appearance-aware
theming. They travel together because all three are about making markup legible and addressable —
and because doing them in one pass means one review, one build check, one diff.

The prime directive: **rendered output and behavior must not change** (except the intended theme
adaptation). A flattened DOM that shifts layout by 4px is a failure, not a win. Be conservative —
leaving a questionable wrapper in place costs nothing; removing a load-bearing one costs the user
their afternoon.

## Phase 0 — Understand before touching

Never start editing. Start by learning what this repo actually is:

1. **Framework and templating.** Plain HTML? JSX/TSX? Svelte? Vue SFC? Deno/Fresh? A template
   language (Handlebars, EJS, Jinja)? This determines what "the DOM" even means — in JSX a wrapper
   may be a component boundary, not just a div.
2. **Build and check commands.** Read `package.json` scripts / `deno.json` tasks / `Makefile` /
   `justfile`. Note the typecheck, lint, build, and test commands. You will need them in Phase 3.
3. **Existing theme system.** This is the question the user most wants answered honestly. Look for:
   - `prefers-color-scheme` media queries
   - `color-scheme` CSS property or `<meta name="color-scheme">`
   - a `.dark` / `[data-theme]` class toggle, and the JS that sets it
   - CSS custom properties that look like tokens (`--bg`, `--fg`, `--surface-1`)
   - a framework's theming (Tailwind `dark:` variants and `darkMode` config, CSS-in-JS themes,
     design-token packages)
   - localStorage keys like `theme`
   - parent/iframe theme contracts (`postMessage`, computed-style reads, copied background or accent
     tokens). Distinguish **parent chrome** (should follow the OS) from a **preview stage** (may
     match the child). Copying a dark child's luminance onto light-OS sidebar tokens is a bug, not
     continuity.

   If the repo has its own theme system, **adapt it, don't replace it.** Extending an existing token
   set or wiring an existing toggle to also follow the system default is the right move. Introducing
   a parallel second theme system is the classic failure here.
4. **Baseline the repo state.** Confirm the working tree is clean (`git status`). If it isn't, say
   so and ask before proceeding — you want a diff that contains only your changes.

`references/detection.md` has concrete grep patterns for all of the above.

## Phase 1 — Audit

Walk the frontend files and collect findings. Don't edit anything yet.

**DOM depth and redundancy.** You're hunting for nesting that exists for no reason. The reliable
signals:

- A wrapper element with exactly one child, no classes/ids/attributes of its own, and no styles
  targeting it
- Chains of nested divs where each layer contributes one property that could collapse into one
  element
- Wrappers that exist only to apply a layout that modern CSS handles on the parent (a flex/grid
  parent can often position children directly — the classic "extra div for centering")
- Repeated identical wrapper structures across sibling items, where the pattern could be simplified
  once
- Non-semantic `div`/`span` doing the job of `<header>`, `<nav>`, `<main>`, `<section>`, `<button>`,
  `<ul>/<li>`

For each candidate, before proposing removal, **check what depends on it**: search the JS/TS for
`querySelector`, `closest`, `parentElement`, `children[n]`, `nextElementSibling`, event delegation
targets, and test selectors; search the CSS for descendant/child/`:nth-child`/`>` combinators that
count on that exact structure. A wrapper referenced by `:nth-child` or `> *` is load-bearing. Record
the dependency finding either way — "safe to remove, nothing references it" is as useful as "keep,
`.card > div` styles it."

**Missing ids.** "Major elements" means the ones a human or a script would want to address: page
landmarks (header, nav, main content, footer, sidebar), each major section, forms and their fields,
primary interactive controls (buttons, toggles, menus), and containers that JS already reaches for
by fragile means. Not every element — an id on every `<li>` is noise. Prefer kebab-case,
descriptive, scoped names (`settings-form`, `repo-list`, `theme-toggle`), and check for collisions,
including ids generated in loops. Where a framework already provides stable hooks (`data-testid`,
`ref`), note that and don't duplicate for its own sake.

**Theme gaps.** Given what you found in Phase 0: hardcoded colors that would break in the other
appearance (`#fff`, `black`, `rgb(...)` in a light-only sheet), missing `color-scheme` declaration
(which is what makes native form controls, scrollbars, and the caret match macOS appearance), a
toggle that has no "System" option, `prefers-color-scheme` handled in CSS but ignored by JS that
sets an inline theme, images/icons/SVGs that only work on one background, and shadows/borders tuned
only for light. When a parent shell embeds an iframe app, split the contract: parent chrome follows
the OS; the child's background belongs on the preview stage; accent/tint may be copied onto chrome.
A child background only on an inner card is invisible to stage sync. Runtime theme changes must
still notify the parent through its existing message. Do not invert the parent's `color-scheme` or
sidebar tokens from the child's luminance — that is what makes a light-OS sidebar look wrong next to
a dark app.

**Write the report** to `dom-theme-audit.md` in the repo root (or wherever the user prefers).
Structure it so the user can approve selectively:

```markdown
# DOM & Theme Audit — <repo name>

## Summary

<2-4 sentences: stack, existing theme system verdict, headline counts>

## Existing theme system

<What's there, or "none found". Be explicit about whether you're extending or introducing.>

## 1. DOM simplification

| #                                                             | File:line | Current | Proposed | Depends on it? | Risk |
| ------------------------------------------------------------- | --------- | ------- | -------- | -------------- | ---- |
| <one row per candidate; Risk = low/medium/high with a reason> |           |         |          |                |      |

## 2. IDs to add

| # | File:line | Element | Proposed id | Why |

## 3. Theme changes

| # | File:line | Issue | Proposed fix |

## Verification plan

<the exact commands you'll run afterward>
```

Then present it and ask which sections (or which numbered items) to apply. **Stop here.** The user
chose report-first for a reason; applying unapproved edits breaks that contract.

## Phase 2 — Apply

Once approved, work in small committable groups and keep the three concerns separate — a diff mixing
structural, id, and color changes is nearly unreviewable.

Order matters: **ids first, then theme, then DOM flattening.** Adding ids is near-zero-risk and
gives you stable handles; converting hardcoded colors to tokens is mechanical; flattening is the
risky one and benefits from going last, when you can see everything else settled.

For DOM changes specifically: change one wrapper at a time and re-check the selectors you catalogued
in Phase 1. When you remove a wrapper that carried styles, those styles must land somewhere —
usually merged onto the surviving element. If a removal requires more than a couple of compensating
changes, that's the signal it wasn't actually redundant; skip it and note why in the report.

For theming, the shape that works in almost every repo:

```css
:root {
  color-scheme: light dark; /* native controls follow the OS */
  --bg: #ffffff;
  --fg: #1d1d1f;
  --surface: #f5f5f7;
  --border: #d2d2d7;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1e1e1e;
    --fg: #f5f5f7;
    --surface: #2c2c2e;
    --border: #3a3a3c;
  }
}
```

`color-scheme` is the piece people forget and it's the one that makes a page feel native on macOS.
If the repo already has a manual toggle, keep it and make "system" the default:
`[data-theme="dark"]` and `[data-theme="light"]` override the media query, absent attribute follows
the OS. Don't invent a token vocabulary that clashes with names the repo already uses.
`references/theming.md` has the toggle-with-system-default pattern, Tailwind specifics, and the
FOUC-avoiding inline script.

## Phase 3 — Verify

The user asked for real verification, so run it, don't assert it:

1. **Repo checks** — the typecheck / lint / build / test commands you found in Phase 0. Every one
   that exists. If a check was already failing before your changes, say so explicitly rather than
   letting it look like your fault.
2. **Selector integrity** — for every element you touched, re-grep the codebase for selectors that
   referenced it. Confirm each still resolves against the new markup. This is the check that catches
   what the build never will, since a broken `querySelector` typecheck-passes and fails at runtime.
3. **Diff review** — read `git diff` in full, as a reviewer would. Look for: styles orphaned by a
   removed wrapper, duplicate ids, changed element order, colors converted to the wrong token, and
   anything you didn't intend.
4. **Runtime theme state** — when theme behavior crosses documents or depends on computed styles,
   inspect the live parent and child in both light and dark appearance. Verify the child's
   background and accent, the parent's chrome `color-scheme`/`--fg`/`--bg` (OS, not the child),
   accent tint on chrome, and the stage/preview surface after initial load and after a runtime theme
   change. A screenshot can show the symptom but not which custom property resolved incorrectly. If
   the OS is light and the child is dark, chrome must stay light.
5. **Report honestly** — what you changed, what you skipped and why, what the checks said, and what
   you could not verify statically (visual regressions, runtime-only paths). If you're unsure
   whether something is safe, say that instead of smoothing it over. The user will re-run this
   skill; a skipped item with a clear reason is more valuable than a silently-taken risk.

## When to push back

If the repo's DOM is already shallow, say so and don't manufacture findings — a report saying
"nothing worth changing here, the markup is clean" is a good outcome. Likewise if the repo has a
deliberate, well-built theme system: verify it handles system appearance and `color-scheme`, report
that it's sound, and stop. Padding the report with marginal items trains the user to stop reading
it.
