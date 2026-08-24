---
name: pr-description
description: Write a pull request description from the actual diff — summary, rationale, and a reviewer checklist. Use when opening a PR, updating a PR body, or when the user says "write the PR description" or "summarize these changes for review".
---

# PR description

Read the diff before writing anything. `git diff <base>...HEAD --stat` for the shape,
then the full diff for the parts that changed behavior.

## Structure

1. **What changed** — one paragraph, plain language, no file listing.
2. **Why** — the problem this solves. Link the issue if one exists.
3. **Review notes** — where to look first, and anything intentionally left out.
4. **Verification** — the commands you actually ran and what they printed.

## Rules

- Describe behavior, not files. "Uploads now retry on 5xx" beats "changed upload.ts".
- Call out anything risky yourself. A reviewer who finds a surprise you hid stops trusting the rest.
- Skip sections that would be empty rather than filling them with "N/A".
