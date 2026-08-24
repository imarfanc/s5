# Skills Hub library

This is the bundled skill library copied from `/Users/arfan3/developer/gh/skills-i1/skills` for the
integrated Skills Hub app.

It lives under `Apps/_shared/` because these Markdown files and template sources are application
data, not sites5 source code: sites5 formatting and linting must not rewrite the content that Skills
Hub installs. The underscore keeps this directory out of app discovery.

The backend reads it through `backends/apps/skills-i1/src/config.ts`; the browser never reads this
directory directly.
## Layout

A skill is any directory here holding a `SKILL.md`. Directories without one are
groups, and the hub walks into them — so `skills/sites5/sites5-app-parity/` is a
skill named `sites5-app-parity` in the `sites5` group. Grouping is a
library-side convenience for keeping related skills together; agents read a flat
skills directory, so a skill always installs under its own leaf name with the
group dropped.

Two skills in different groups sharing a leaf name would install to the same
place. The hub lists both with a warning rather than picking a winner; rename
one.

Nesting is bounded at three path segments, which keeps a stray `node_modules`
from turning a listing into a full-disk walk.
