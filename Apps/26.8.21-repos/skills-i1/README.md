# Skills Hub

An integrated copy of `/Users/arfan3/developer/gh/skills-i1`, adapted to run inside sites5 in the
same style as `cmux1` and `my-repos-v1`.

## Integration

- `index.html` remains the complete dependency-free frontend.
- Browser calls are namespaced under `/api/apps/skills-i1/`.
- `backends/apps/skills-i1/` contains the full copied skill library, settings, installer, preview,
  removal, and directory-opening behavior.
- Skills may sit at the root of the library or inside a group folder (`skills/sites5/...`). The
  browser addresses a skill by its library-relative `id` and installs it under its leaf `name`, so
  groups never leak into an agent's skills directory. Groups appear as headings in the list.
- The configured “This repo” target resolves to the sites5 repository.
- Authentication is inherited from sites5; there is no second server or port.

Run `deno task dev`, restart after adding the app, and open
`/apps/26.8.21-repos/skills-i1/`.

Installing never overwrites an existing skill unless the UI explicitly sends its Replace action.
Removing a skill keeps the source app's confirmation prompt and deletes only that skill's resolved
agent directory.
