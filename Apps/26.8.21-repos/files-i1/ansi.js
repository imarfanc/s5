/** SGR colour for the files-i1 output pane (tldr, tree). */

const FG = {
  30: "#9a8f7d",
  31: "#ef6b4a",
  32: "#8fbf6a",
  33: "#e0b04a",
  34: "#7aa2d4",
  35: "#c989d4",
  36: "#6ec4c4",
  37: "#f0ead8",
  90: "#9a8f7d",
  91: "#ff8a70",
  92: "#b4e07a",
  93: "#f5d06a",
  94: "#9cbcf0",
  95: "#e0a8ea",
  96: "#8ee0e0",
  97: "#fffaf0",
};

const SGR = /\u001b\[([0-9;]*)m/g;

export function stripAnsi(text) {
  return String(text).replace(/\u001b\[[0-9;]*[A-Za-z]/g, "").replace(SGR, "");
}

function apply(state, codes) {
  const next = { ...state, classes: [...state.classes] };
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    if (code === 0 || codes.length === 0) return { color: null, classes: [] };
    if (code === 1) next.classes = [...new Set([...next.classes, "ansi-bold"])];
    else if (code === 2) next.classes = [...new Set([...next.classes, "ansi-dim"])];
    else if (code === 3) next.classes = [...new Set([...next.classes, "ansi-italic"])];
    else if (code === 4) next.classes = [...new Set([...next.classes, "ansi-underline"])];
    else if (code === 22) next.classes = next.classes.filter((n) => n !== "ansi-bold" && n !== "ansi-dim");
    else if (code === 39) next.color = null;
    else if (code === 38 && codes[i + 1] === 5 && codes[i + 2] !== undefined) {
      const n = codes[i + 2];
      next.color = FG[n] ?? `hsl(${(n * 360) / 256} 70% 65%)`;
      i += 2;
    } else if (FG[code]) next.color = FG[code];
  }
  return next;
}

export function ansiFragment(text) {
  const cleaned = String(text).replace(/\u001b\[[0-9;]*[A-HJKSTf]/g, "");
  const fragment = document.createDocumentFragment();
  let state = { color: null, classes: [] };
  let last = 0;
  SGR.lastIndex = 0;
  let match;
  const flush = (end) => {
    const chunk = cleaned.slice(last, end);
    if (!chunk) return;
    const span = document.createElement("span");
    span.textContent = chunk;
    if (state.color) span.style.color = state.color;
    if (state.classes.length) span.className = state.classes.join(" ");
    fragment.append(span);
  };
  while ((match = SGR.exec(cleaned)) !== null) {
    flush(match.index);
    const codes = match[1]
      ? match[1].split(";").map((part) => Number.parseInt(part, 10)).filter((n) => !Number.isNaN(n))
      : [0];
    state = apply(state, codes.length ? codes : [0]);
    last = SGR.lastIndex;
  }
  flush(cleaned.length);
  return fragment;
}
