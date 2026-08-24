/**
 * Client-side file coloring layered under ANSI.
 * Only wraps tokens the shell left uncolored; injected as truecolor SGR for xterm.
 *
 * Usage:
 *   const tint = FileTint.createState();
 *   term.write(FileTint.tint(chunk, tint));
 */
(() => {
  const ESC = "\x1b";
  const RESET_FG = ESC + "[39m";

  // Match the terminal's file-type colors in each system appearance.
  const DARK = {
    dir: "#8fb6e0",
    code: "#8fd6a8",
    data: "#e2c98b",
    doc: "#c5cdd8",
    media: "#c4a2dd",
    dim: "#495260",
  };
  const LIGHT = {
    dir: "#3978b8",
    code: "#34784b",
    data: "#85630b",
    doc: "#566474",
    media: "#765096",
    dim: "#697482",
  };
  const appearance = matchMedia("(prefers-color-scheme: light)");
  const filePalette = () => appearance.matches ? LIGHT : DARK;

  const EXT_COLOR = {
    ts: "code", tsx: "code", js: "code", jsx: "code", mjs: "code", cjs: "code",
    py: "code", rb: "code", go: "code", rs: "code", java: "code", kt: "code",
    swift: "code", c: "code", h: "code", cpp: "code", cc: "code", hpp: "code",
    cs: "code", php: "code", sh: "code", bash: "code", zsh: "code", fish: "code",
    css: "code", scss: "code", less: "code",
    json: "data", jsonc: "data", yaml: "data", yml: "data", toml: "data",
    ini: "data", conf: "data", cfg: "data", csv: "data", tsv: "data",
    xml: "data", sql: "data",
    md: "doc", mdx: "doc", txt: "doc", rst: "doc", pdf: "doc",
    html: "doc", htm: "doc",
    svg: "media", png: "media", jpg: "media", jpeg: "media", gif: "media",
    webp: "media", ico: "media", mp3: "media", mp4: "media", wav: "media",
    mov: "media", zip: "media", tar: "media", gz: "media", tgz: "media",
    bz2: "media", xz: "media", "7z": "media", rar: "media",
    lock: "dim", log: "dim", map: "dim",
  };

  function fileColor(token) {
    const palette = filePalette();
    if (!token || token === "." || token === "..") return null;
    const name = token.replace(/[\*\@\=\|]$/, "");
    if (!name) return null;
    if (name.endsWith("/")) return palette.dir;
    if (name.startsWith(".") && !name.includes("/", 1)) {
      const dot = name.lastIndexOf(".");
      if (dot > 0) {
        const ext = name.slice(dot + 1).toLowerCase();
        if (EXT_COLOR[ext]) return palette[EXT_COLOR[ext]];
      }
      return palette.dim;
    }
    if (name.endsWith(".lock") || name === "LICENSE" || name === "COPYING") {
      return palette.dim;
    }
    const base = name.split("/").pop() || name;
    const dot = base.lastIndexOf(".");
    if (dot > 0 && dot < base.length - 1) {
      const ext = base.slice(dot + 1).toLowerCase();
      if (EXT_COLOR[ext]) return palette[EXT_COLOR[ext]];
    }
    if (name.includes("/") || name.includes(".")) return palette.data;
    return null;
  }

  function hexToSgr(hex) {
    const n = parseInt(hex.slice(1), 16);
    return ESC + `[38;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m`;
  }

  function incompleteEscape(chunk, i) {
    if (chunk[i] !== ESC) return false;
    const rest = chunk.slice(i);
    if (rest.length === 1) return true;
    if (rest[1] === "]") {
      return !(rest.includes("\u0007") || rest.includes(ESC + "\\"));
    }
    if (rest[1] === "[") {
      return !/^[0-9:;<=>?]*[ -/]*[@-~]/.test(rest.slice(2));
    }
    return rest.length < 2;
  }

  function noteSgr(body, state) {
    const params = body ? body.split(/[;:]/).map((n) => (n === "" ? 0 : Number(n) || 0)) : [0];
    if (!params.length) params.push(0);
    for (let i = 0; i < params.length; i++) {
      const p = params[i];
      if (p === 0 || p === 39) state.colored = false;
      else if ((p >= 30 && p <= 37) || (p >= 90 && p <= 97) || p === 38) {
        state.colored = true;
        if (p === 38) break;
      }
    }
  }

  function emitPlain(text, state) {
    if (!text) return "";
    if (state.colored) return text;
    // Flush immediately. Holding the last token hid interactive echo until
    // whitespace or enter — typed text vanished until the line submitted.
    const parts = text.split(/(\s+)/);
    let out = "";
    for (const part of parts) {
      if (!part || /^\s+$/.test(part)) {
        out += part;
        continue;
      }
      const color = fileColor(part);
      out += color ? hexToSgr(color) + part + RESET_FG : part;
    }
    return out;
  }

  function createState() {
    return { pending: "", colored: false };
  }

  /** Tint uncolored filename tokens; pass shell ANSI through untouched. */
  function tint(chunk, state) {
    const data = state.pending + chunk;
    state.pending = "";
    let out = "";
    let i = 0;
    while (i < data.length) {
      if (incompleteEscape(data, i)) {
        state.pending = data.slice(i);
        break;
      }
      if (data[i] === ESC) {
        const next = data[i + 1];
        if (next === "]") {
          let end = data.indexOf("\u0007", i + 2);
          const st = data.indexOf(ESC + "\\", i + 2);
          if (st >= 0 && (end < 0 || st < end)) end = st + 1;
          const stop = end >= 0 ? end + 1 : data.length;
          out += data.slice(i, stop);
          i = stop;
          continue;
        }
        if (next === "[") {
          let j = i + 2;
          while (j < data.length && data[j] >= " " && data[j] <= "?") j++;
          const final = data[j];
          const body = data.slice(i + 2, j);
          if (final === "m") noteSgr(body, state);
          out += data.slice(i, final ? j + 1 : data.length);
          i = final ? j + 1 : data.length;
          continue;
        }
        out += data.slice(i, i + 2);
        i += 2;
        continue;
      }
      let j = i;
      while (j < data.length && data[j] !== ESC) j++;
      out += emitPlain(data.slice(i, j), state);
      i = j;
    }
    return out;
  }

  globalThis.FileTint = { createState, tint };
})();
