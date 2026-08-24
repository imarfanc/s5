---
name: "git-commit-ascii"
description: "Commit changes to git using two freely-chosen emojis + a descriptive action word (for example `⭐🔧 add`, `🐛💥 repair`, `♻️✨ reshape`), with an ANSI Shadow word-art banner and aligned change table. Use this skill whenever the user wants to create a git commit, mentions committing, says \"commit these changes\", \"git commit\", \"amend/fold changes into a commit\", \"I just finished [task], commit it\", or any variation where they want to save their work to git. Even if they don't explicitly say \"commit\" but clearly want to save their work or move to the next step of their workflow."
---

Create clean git commits with dual-emoji titles and a rich body format
(ANSI Shadow word art + table + narrative).

## Workflow

1. **Check what's staged** — run `git status`. If nothing is staged, tell the
   user and stop; never stage files yourself. Ignore unstaged/untracked files
   entirely — the staging area is the user's explicit choice of what to commit.
2. **Show the changes** — run `git diff --staged` so the user can review
   before anything happens.
3. **Run the repo's check task if one exists** (`deno task check`,
   `npm test`, `just check`, …). If it fails, fix the blocking issues, list
   those fixes for the user, then continue. Report them separately from the
   intended change — they are not part of the commit's story.
4. **Draft the message** (format below) and display it to the user.
5. **Commit** — run `git commit` with the drafted message and report the
   result. Let pre-commit hooks run normally (no `--no-verify`); if a hook
   fails, tell the user and let them decide. Stop at the local commit: no
   push, no `vt push` or other deploy step, even if repo rules mention one
   elsewhere.

### Amending / folding changes into an existing commit

If the user asks to add changes to an existing commit (by SHA or "the last
one"):

- If that commit is `HEAD`: stage the files and `git commit --amend --no-edit`
  (or `--amend` with a revised message if the change alters the story).
- If it is further back: use `git rebase -i` with a `fixup`, and warn the user
  first that this rewrites history.
- **Always tell the user the new SHA and that the old one no longer exists** —
  rewriting a commit always changes its hash.

### Ignored files

`**/.vt/state.json` (Val Town runtime state) is committed like anything else
but should not influence the commit message — it's machine-generated noise.
If it's the *only* staged change, use a generic message like
`🔧⚙️ maintain: update val town state` and proceed.

## Message Format

**Title:** `emoji1 emoji2 action(scope): description`

- Pick the two emojis freely — no fixed mappings. First emoji = change *type*
  (fix, add, cleanup…), second = *domain* (backend, UI, config, data…).
- Pick one action word from the table below (best single fit; if mixed, the
  dominant change wins).
- Description in imperative mood, lowercase: "add login support".
- Scope in parentheses when applicable: `⭐🔑 add(auth): add JWT support`.
- Breaking changes: `!` after action/scope
  (`💥🔌 add(api)!: remove deprecated endpoints`) plus a
  `BREAKING CHANGE:` footer if needed.

| Action                              | When                                                   |
| ----------------------------------- | ------------------------------------------------------ |
| `launch`                            | First landing of a new project or val (`VALS/<name>/`) |
| `add` / `introduce` / `expand`      | Net-new features or capability                         |
| `diff` / `patch`                    | Cross-cutting multi-file change sets                   |
| `repair` / `fix`                    | Bug fix or behavioral correction                       |
| `reshape` / `refactor` / `simplify` | Refactoring, no behavior change                        |
| `document` / `clarify`              | Documentation only                                     |
| `polish` / `style`                  | UI polish or code-style cleanup                        |
| `maintain` / `tune` / `configure`   | Chore, config, tooling, dependencies                   |
| `verify` / `cover`                  | Tests or validation                                    |
| `speed` / `optimize`                | Performance                                            |
| `package` / `build`                 | Build system or packaging                              |
| `automate` / `ci`                   | CI/CD or automation                                    |
| `revert` / `remove`                 | Reverts or intentional removals                        |

**Body** — always the full format, never a bare subject line. Three parts, in
order:

1. **Word art banner** — ANSI Shadow block letters (see below).
2. **Markdown table** — one row per changed area/file, emoji prefix on area
   names, columns `Area` | `What changed`, one short line each. **Generate it
   with `scripts/align_table.py`** (see below).
3. **Narrative paragraph** — 1–3 sentences on root cause, motivation, or
   context. Skip only for trivial commits (single-file typo fix, etc.).

The body should explain WHAT and WHY, not HOW.

## Word Art (ANSI Shadow)

The banner is **always ANSI Shadow style solid block letters** — the
`██╗`/`╚═╝` shadowed form. Never hollow/outline letters, never half-block
(`█▀█ █▄█`) styles; both come out illegible.

- Default to **two lines of text**: the action/topic on line one, the project
  or scope on line two (e.g. `RESTRUCTURE` over `MY REPOS V1`). One line is
  fine for short single-word topics.
- Keep each line short enough to stay under ~100 columns (roughly 11
  characters at 8–10 columns per glyph).
- Indent every rendered row with one leading space.
- Box diagrams (`┌─┐│└─┘`) remain the alternative style for tiny commits
  where a diagram says more than a word.

**Do not hand-draw the glyphs.** `figlet`/`pyfiglet` usually do *not* ship the
ANSI Shadow font, so render with the bundled generator instead: write the
script below to a temp file, run it, and paste the output verbatim.

```python
#!/usr/bin/env python3
"""ANSI Shadow word art. Usage: ansi_shadow.py "LINE ONE" "LINE TWO" """
import sys

G = {
"A":" █████╗ |██╔══██╗|███████║|██╔══██║|██║  ██║|╚═╝  ╚═╝",
"B":"██████╗ |██╔══██╗|██████╔╝|██╔══██╗|██████╔╝|╚═════╝ ",
"C":" ██████╗|██╔════╝|██║     |██║     |╚██████╗| ╚═════╝",
"D":"██████╗ |██╔══██╗|██║  ██║|██║  ██║|██████╔╝|╚═════╝ ",
"E":"███████╗|██╔════╝|█████╗  |██╔══╝  |███████╗|╚══════╝",
"F":"███████╗|██╔════╝|█████╗  |██╔══╝  |██║     |╚═╝     ",
"G":" ██████╗ |██╔════╝ |██║  ███╗|██║   ██║|╚██████╔╝| ╚═════╝ ",
"H":"██╗  ██╗|██║  ██║|███████║|██╔══██║|██║  ██║|╚═╝  ╚═╝",
"I":"██╗|██║|██║|██║|██║|╚═╝",
"J":"     ██╗|     ██║|     ██║|██   ██║|╚█████╔╝| ╚════╝ ",
"K":"██╗  ██╗|██║ ██╔╝|█████╔╝ |██╔═██╗ |██║  ██╗|╚═╝  ╚═╝",
"L":"██╗     |██║     |██║     |██║     |███████╗|╚══════╝",
"M":"███╗   ███╗|████╗ ████║|██╔████╔██║|██║╚██╔╝██║|██║ ╚═╝ ██║|╚═╝     ╚═╝",
"N":"███╗   ██╗|████╗  ██║|██╔██╗ ██║|██║╚██╗██║|██║ ╚████║|╚═╝  ╚═══╝",
"O":" ██████╗ |██╔═══██╗|██║   ██║|██║   ██║|╚██████╔╝| ╚═════╝ ",
"P":"██████╗ |██╔══██╗|██████╔╝|██╔═══╝ |██║     |╚═╝     ",
"Q":" ██████╗ |██╔═══██╗|██║   ██║|██║▄▄ ██║|╚██████╔╝| ╚══▀▀═╝ ",
"R":"██████╗ |██╔══██╗|██████╔╝|██╔══██╗|██║  ██║|╚═╝  ╚═╝",
"S":"███████╗|██╔════╝|███████╗|╚════██║|███████║|╚══════╝",
"T":"████████╗|╚══██╔══╝|   ██║   |   ██║   |   ██║   |   ╚═╝   ",
"U":"██╗   ██╗|██║   ██║|██║   ██║|██║   ██║|╚██████╔╝| ╚═════╝ ",
"V":"██╗   ██╗|██║   ██║|██║   ██║|╚██╗ ██╔╝| ╚████╔╝ |  ╚═══╝  ",
"W":"██╗    ██╗|██║    ██║|██║ █╗ ██║|██║███╗██║|╚███╔███╔╝| ╚══╝╚══╝ ",
"X":"██╗  ██╗|╚██╗██╔╝| ╚███╔╝ | ██╔██╗ |██╔╝ ██╗|╚═╝  ╚═╝",
"Y":"██╗   ██╗|╚██╗ ██╔╝| ╚████╔╝ |  ╚██╔╝  |   ██║   |   ╚═╝   ",
"Z":"███████╗|╚══███╔╝|  ███╔╝ | ███╔╝  |███████╗|╚══════╝",
"0":" ██████╗ |██╔═████╗|██║██╔██║|████╔╝██║|╚██████╔╝| ╚═════╝ ",
"1":" ██╗|███║|╚██║| ██║| ██║| ╚═╝",
"2":"██████╗ |╚════██╗| █████╔╝|██╔═══╝ |███████╗|╚══════╝",
"3":"██████╗ |╚════██╗| █████╔╝| ╚═══██╗|██████╔╝|╚═════╝ ",
"4":"██╗  ██╗|██║  ██║|███████║|╚════██║|     ██║|     ╚═╝",
"5":"███████╗|██╔════╝|███████╗|╚════██║|███████║|╚══════╝",
"6":" ██████╗ |██╔════╝ |███████╗ |██╔═══██╗|╚██████╔╝| ╚═════╝ ",
"7":"███████╗|╚════██║|    ██╔╝|   ██╔╝ |   ██║  |   ╚═╝  ",
"8":" █████╗ |██╔══██╗|╚█████╔╝|██╔══██╗|╚█████╔╝| ╚════╝ ",
"9":" █████╗ |██╔══██╗|╚██████║| ╚═══██║| █████╔╝| ╚════╝ ",
" ":"   |   |   |   |   |   ",
"-":"      |      |█████╗|╚════╝|      |      ",
".":"   |   |   |   |██╗|╚═╝",
"!":"██╗|██║|██║|╚═╝|██╗|╚═╝",
"/":"    ██╗|   ██╔╝|  ██╔╝ | ██╔╝  |██╔╝   |╚═╝    ",
}

def render(text):
    rows = [""] * 6
    for ch in text.upper():
        g = G.get(ch, G[" "]).split("|")
        for i in range(6):
            rows[i] += g[i]
    return [r.rstrip() for r in rows]

if __name__ == "__main__":
    out = []
    for line in (sys.argv[1:] or ["HELLO"]):
        out.extend(render(line))
    print("\n".join(" " + r for r in out))
```

## Table Alignment

Emoji render 2 columns wide in monospace; padding by character count breaks
every row containing one. **Never hand-align** — hand-counting has failed
every time it's been tried. Pipe the rough table through the bundled script
(it lives in this skill's own directory, *not* the repo) and paste its output
**verbatim**:

```bash
python3 <skill-dir>/scripts/align_table.py <<'EOF'
| Area | What changed |
| --- | --- |
| 🔎 filter.ts | toLowerCase() applied to tag compare |
EOF
```

If you can't locate the bundled script, do not fall back to hand-aligning —
recreate it from this core and pad each cell to the column's max display
width:

```python
import unicodedata
def disp_width(s):
    w = 0
    for ch in s:
        cp = ord(ch)
        if cp in (0xFE0F, 0xFE0E, 0x200D) or unicodedata.combining(ch):
            continue
        w += 2 if (0x1F300 <= cp <= 0x1FAFF or 0x2600 <= cp <= 0x27BF) else 1
    return w
```

Never hand-edit the output afterward, even by one space — a single manual
tweak reintroduces misalignment (this has happened before). If the table
needs to change, edit the input and rerun.

If the ASCII art is a box (`┌─┐│└─┘`), size it to the table's total width so
both share a right edge. Block-letter word art just needs its own lines even.

## Examples

**Two-line banner (default):**

```text
♻️🗂️ reshape(repo): flatten tooling into top-level src/server/shared/tools

 ██████╗ ███████╗███████╗████████╗██████╗ ██╗   ██╗ ██████╗████████╗██╗   ██╗██████╗ ███████╗
 ██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔══██╗██║   ██║██╔════╝╚══██╔══╝██║   ██║██╔══██╗██╔════╝
 ██████╔╝█████╗  ███████╗   ██║   ██████╔╝██║   ██║██║        ██║   ██║   ██║██████╔╝█████╗
 ██╔══██╗██╔══╝  ╚════██║   ██║   ██╔══██╗██║   ██║██║        ██║   ██║   ██║██╔══██╗██╔══╝
 ██║  ██║███████╗███████║   ██║   ██║  ██║╚██████╔╝╚██████╗   ██║   ╚██████╔╝██║  ██║███████╗
 ╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝  ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝
 ███╗   ███╗██╗   ██╗   ██████╗ ███████╗██████╗  ██████╗ ███████╗   ██╗   ██╗ ██╗
 ████╗ ████║╚██╗ ██╔╝   ██╔══██╗██╔════╝██╔══██╗██╔═══██╗██╔════╝   ██║   ██║███║
 ██╔████╔██║ ╚████╔╝    ██████╔╝█████╗  ██████╔╝██║   ██║███████╗   ██║   ██║╚██║
 ██║╚██╔╝██║  ╚██╔╝     ██╔══██╗██╔══╝  ██╔═══╝ ██║   ██║╚════██║   ╚██╗ ██╔╝ ██║
 ██║ ╚═╝ ██║   ██║      ██║  ██║███████╗██║     ╚██████╔╝███████║    ╚████╔╝  ██║
 ╚═╝     ╚═╝   ╚═╝      ╚═╝  ╚═╝╚══════╝╚═╝      ╚═════╝ ╚══════╝     ╚═══╝   ╚═╝

| Area          | What changed                                    |
| ------------- | ----------------------------------------------- |
| 🗂️ server/    | moved out of src/, now top-level                |
| 🔧 shared/    | generic helpers: terminal, fs, paths, process   |
| 🧪 tests/     | paths updated to the new layout                 |

Tooling lived three directories deep under `_repo/`, so every import crossed a
boundary that no longer meant anything. Flattening removes the indirection
without changing behavior.
```

**Small bug fix (box style):**

```text
🐛🔍 repair(search): fix case-sensitive tag matching

  ┌────────────────────────────┐
  │  before: "React" ≠ "react" │
  │  after:  both match ✓      │
  └────────────────────────────┘

| Area         | What changed                         |
| ------------ | ------------------------------------ |
| 🔎 filter.ts | toLowerCase() applied to tag compare |

Tags were compared with strict equality; lowercasing both sides fixes search
for users who type in any case.
```

