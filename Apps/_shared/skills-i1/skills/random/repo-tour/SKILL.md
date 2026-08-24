---
name: repo-tour
description: Orient yourself in an unfamiliar repository before changing anything — entrypoints, build and test commands, layering rules, and local conventions. Use when starting work in a new codebase, when asked "how does this repo work", or before a first change to a repo you have not touched.
---

# Repo tour

The goal is a short written map you can act from, not a complete understanding.

## Order

1. Read `README.md`, `AGENTS.md`/`CONTRIBUTING.md`, and the package manifest. The manifest's
   scripts or tasks tell you what the maintainers actually run.
2. Find the entrypoints — what starts the app, what CI invokes.
3. Run the test/check command once, unchanged, before editing. A repo that is already red tells
   you something important, and it gives you a baseline.
4. Skim the directory names for a layering rule (a `scripts/` that must not import `src/`, a
   `core/` that must not import `web/`). Violating one of these is the fastest way to get a
   change rejected.

## Output

Write four to eight bullets: how to run it, how to test it, where the code you need lives,
and the conventions you'd otherwise break. Keep it in the conversation unless asked to save it.
