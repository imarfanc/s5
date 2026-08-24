# Shared terminal frontend

Vendored browser assets for the terminal apps in this repository. No build step, no package
manager: the files are served as they are.

- `xterm.js` is the xterm.js browser terminal.
- `xterm-addon-fit.js` resizes a terminal to fit its container.
- `xterm.css` holds the styles xterm.js requires.
- `file-tint.js` colors filenames in shell output that arrives without ANSI color. It is optional
  and keeps state across chunks, so a filename split across two writes still gets tinted.

Reference these as `/apps/_shared/1-repos/<file>`. The `_shared` prefix keeps the folder out of app
discovery while still serving its files to any app.

The bundles have their `sourceMappingURL` comments stripped. Source maps are not vendored here, and
leaving the comments in would send browser devtools after files that do not exist.
