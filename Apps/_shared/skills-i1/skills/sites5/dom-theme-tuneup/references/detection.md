# Detection patterns

Concrete searches for Phase 0 and Phase 1. Adjust globs to the repo's stack.

## Stack identification

```bash
ls package.json deno.json deno.jsonc justfile Makefile 2>/dev/null
# scripts / tasks — these become the Phase 3 verification commands
cat package.json | grep -A30 '"scripts"'
cat deno.json | grep -A30 '"tasks"'
```

File types present tell you the templating model:

```bash
git ls-files | grep -Ei '\.(html|htm|jsx|tsx|vue|svelte|astro|ejs|hbs|njk|liquid|erb|jinja|j2)$' | head -50
```

In JSX/TSX, Vue, and Svelte a "wrapper div" may be a component root — removing it can change what
the parent's CSS or props target. Fragments (`<>...</>`) are often the correct replacement for a
styleless single-child root.

## Existing theme system

```bash
grep -rn "prefers-color-scheme" --include=*.{css,scss,less,html,js,ts,jsx,tsx,vue,svelte} .
grep -rn "color-scheme" --include=*.{css,html} .
grep -rn "data-theme\|\.dark\b\|classList.*dark\|darkMode" -r --include=*.{css,js,ts,jsx,tsx,json,vue,svelte} .
grep -rn "localStorage.*theme\|matchMedia" --include=*.{js,ts,jsx,tsx,vue,svelte} .
grep -rn -- "--[a-z-]*\(bg\|background\|fg\|foreground\|color\|surface\|text\|border\)" --include=*.{css,scss} . | head -40
```

Verdicts and what they imply:

- **No hits anywhere** → introduce a token layer + `prefers-color-scheme`, nothing to preserve.
- **`prefers-color-scheme` only, no toggle** → good baseline; check `color-scheme` is declared and
  that all colors flow through tokens.
- **Class/attribute toggle, no media query** → the repo has a theme system that ignores the OS. The
  fix is making "system" the default state, not bolting on a second mechanism.
- **Tailwind** → check `darkMode` in the Tailwind config. `'media'` already follows the OS;
  `'class'` or `'selector'` needs JS to seed the class from `matchMedia`. Fix themes in the
  config/`@theme` layer, not by adding a competing stylesheet.
- **Design-token package or CSS-in-JS theme** → treat as authoritative; extend its dark palette
  rather than writing raw CSS.
- **Parent copies iframe luminance onto chrome** (`data-preview-tone`, `--preview-bg` on the
  sidebar, `color-scheme` flipped from child background) → the chrome is chameleon-themed. That
  fights macOS when the child is dark and the OS is light. Keep OS tokens on chrome; put the child
  background on the preview stage; copy accent only.

## Structural dependencies — check before removing anything

```bash
# JS/TS reaching into the DOM by structure
grep -rn "querySelector\|getElementById\|getElementsBy\|closest(\|parentElement\|parentNode\|children\[\|firstElementChild\|nextElementSibling\|insertAdjacent" --include=*.{js,ts,jsx,tsx,vue,svelte} .

# CSS that depends on exact nesting
grep -rn "nth-child\|nth-of-type\|first-child\|last-child\|> \*\|:has(\|+ \|~ " --include=*.{css,scss,less} .

# test / automation hooks
grep -rn "data-testid\|getByRole\|getByTestId\|page.locator\|cy\.get" .
```

Anything matched here that points at a wrapper you wanted to remove makes it **load-bearing**.
Either keep it, or update the selector in the same change and verify — never remove and hope.

## Existing ids and collisions

```bash
grep -rno 'id="[^"]*"' --include=*.{html,jsx,tsx,vue,svelte,ejs,hbs} . | sed 's/.*id="//;s/"//' | sort | uniq -d
```

Duplicates already present are a finding. Ids emitted inside `map`/loops must be suffixed with a
stable key, never an array index if the list reorders.

## Hardcoded colors

```bash
grep -rn "#[0-9a-fA-F]\{3,8\}\b\|rgba\?(\|hsla\?(" --include=*.{css,scss,less,js,ts,jsx,tsx,vue,svelte} . | grep -v "var(--"
```

Not every hit needs tokenizing — a brand logo color or a fixed overlay may be intentionally
appearance-independent. Judge by whether the value would look wrong on the opposite background.
