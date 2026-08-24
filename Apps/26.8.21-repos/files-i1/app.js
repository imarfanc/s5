import { ansiFragment, stripAnsi } from "./ansi.js";

const API = "/api/apps/files-i1";
const RECENT_KEY = "sites5.files-i1.recent";

const TOOLS = [
  { id: "search", group: "Find", label: "Search", bin: "rg" },
  { id: "find", group: "Find", label: "Find files", bin: "fd" },
  { id: "fuzzy", group: "Find", label: "Fuzzy find", bin: "fzf" },
  { id: "tree", group: "Find", label: "Tree", bin: "tree" },
  { id: "ds_store", group: "Clean", label: ".DS_Store", bin: null },
  { id: "node_modules", group: "Clean", label: "node_modules", bin: null },
  { id: "xcode", group: "Clean", label: "Xcode", bin: null },
  { id: "space", group: "Analyze", label: "Space", bin: null },
  { id: "doc", group: "Reference", label: "man / tldr", bin: "man" },
  { id: "health", group: "Host", label: "Tools", bin: null },
];

const BREW_FALLBACK = {
  rg: "brew install ripgrep",
  fd: "brew install fd",
  fzf: "brew install fzf",
  tree: "brew install tree",
  tldr: "brew install tldr",
  trash: "brew install trash",
};

const state = {
  root: "",
  home: "",
  tool: "search",
  tools: {},
  items: [],
  spaceRoot: "",
};

function $(id) {
  return document.getElementById(id);
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `${response.status}`);
  return data;
}

function recents() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function pushRecent(path) {
  const next = [path, ...recents().filter((item) => item !== path)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

let waitTimer = 0;
let waitStarted = 0;
let waitLabel = "";

function stopWait() {
  clearInterval(waitTimer);
  waitTimer = 0;
  waitStarted = 0;
  waitLabel = "";
}

function paintWait() {
  const secs = Math.floor((Date.now() - waitStarted) / 1000);
  $("banner").textContent = `${waitLabel} ${secs}s`;
}

function banner(text) {
  stopWait();
  const node = $("banner");
  if (!text) {
    node.hidden = true;
    node.textContent = "";
    return;
  }
  node.hidden = false;
  if (text.endsWith("…") || text.endsWith("...")) {
    waitLabel = text;
    waitStarted = Date.now();
    paintWait();
    waitTimer = setInterval(paintWait, 200);
    return;
  }
  node.textContent = text;
}

function showCommand(text) {
  const node = $("ran");
  node.hidden = !text;
  node.textContent = text || "";
}

function copyIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    '<rect x="5" y="5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H11" fill="none" stroke="currentColor" stroke-width="1.4"/>';
  return svg;
}

function copyButton(text, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-icon";
  button.title = label || "Copy";
  button.setAttribute("aria-label", label || "Copy");
  button.append(copyIcon());
  button.addEventListener("click", async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    button.dataset.copied = "1";
    setTimeout(() => delete button.dataset.copied, 1200);
  });
  return button;
}

function missingBrewCommands() {
  return Object.entries(state.tools)
    .filter(([, info]) => !info.present && info.brew?.startsWith("brew "))
    .map(([, info]) => info.brew);
}

async function loadHealth() {
  const health = await api("/health");
  state.tools = health.tools || {};
}

function renderHealth() {
  const wrap = document.createElement("div");
  wrap.className = "health";
  const head = document.createElement("div");
  head.className = "health-head";
  const missing = missingBrewCommands();
  const title = document.createElement("p");
  title.className = "health-copy-line";
  title.textContent = missing.length ? missing.join(" && ") : "All host tools are present.";
  head.append(title);
  if (missing.length) head.append(copyButton(missing.join(" && "), "Copy brew commands"));
  wrap.append(head);

  const list = document.createElement("ul");
  list.className = "health-list";
  const names = Object.keys(state.tools).length
    ? Object.keys(state.tools)
    : ["rg", "fd", "fzf", "tree", "tldr", "trash", "man"];
  for (const name of names) {
    const info = state.tools[name] || { present: false, brew: BREW_FALLBACK[name] || "" };
    const li = document.createElement("li");
    li.className = info.present ? "ok" : "miss";
    const bin = document.createElement("code");
    bin.textContent = name;
    const status = document.createElement("span");
    status.textContent = info.present ? "present" : "missing";
    const cmd = document.createElement("code");
    cmd.className = "brew";
    cmd.textContent = info.brew || "";
    li.append(bin, status, cmd);
    if (info.brew?.startsWith("brew ")) li.append(copyButton(info.brew, `Copy ${info.brew}`));
    list.append(li);
  }
  wrap.append(list);
  $("panel-body").replaceChildren(wrap);
}

function bytes(n) {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

function toolMeta() {
  return TOOLS.find((tool) => tool.id === state.tool);
}

function toolDisabled(tool) {
  if (!tool.bin) return false;
  const info = state.tools[tool.bin];
  return info ? !info.present : false;
}

function renderRail() {
  const rail = $("tool-rail");
  rail.replaceChildren();
  let last = "";
  for (const tool of TOOLS) {
    if (tool.group !== last) {
      const group = document.createElement("section");
      group.className = "tool-group";
      group.innerHTML = `<h2>${tool.group}</h2>`;
      rail.append(group);
      last = tool.group;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tool-btn";
    button.textContent = tool.label;
    button.disabled = toolDisabled(tool);
    button.setAttribute("aria-current", tool.id === state.tool ? "true" : "false");
    button.addEventListener("click", () => {
      state.tool = tool.id;
      renderRail();
      renderForm();
      banner("");
      if (tool.id === "health") renderHealth();
      else $("panel-body").replaceChildren();
    });
    rail.lastElementChild.append(button);
  }
}

function crumbs(path) {
  const home = state.home;
  const list = $("path-crumbs");
  list.replaceChildren();
  if (!path || !home) return;
  const rel = path === home ? "" : path.startsWith(`${home}/`) ? path.slice(home.length + 1) : path;
  const parts = rel ? rel.split("/") : [];
  let cursor = home;
  for (const part of parts) {
    cursor = `${cursor}/${part}`;
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `/${part}`;
    const target = cursor;
    button.addEventListener("click", () => setRoot(target));
    li.append(button);
    list.append(li);
  }
}

async function setRoot(path) {
  const view = await api(`/browse?path=${encodeURIComponent(path)}`);
  state.root = view.path;
  state.home = view.home;
  state.spaceRoot = view.path;
  pushRecent(view.path);
  crumbs(view.path);
  $("picker-path").value = view.path;
  syncCommandPreview();
}

function field(label, inner, kind) {
  const wrap = document.createElement("label");
  const isCheck = inner.type === "checkbox";
  wrap.dataset.kind = kind || (isCheck ? "check" : "stack");
  if (isCheck) wrap.append(inner, document.createTextNode(label));
  else wrap.append(label, inner);
  return wrap;
}

function input(attrs) {
  const node = document.createElement("input");
  Object.assign(node, attrs);
  return node;
}

function select(name, options) {
  const node = document.createElement("select");
  node.name = name;
  for (const [value, label] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    node.append(option);
  }
  return node;
}

function renderForm() {
  const form = $("tool-form");
  form.replaceChildren();
  const id = state.tool;
  if (id === "search") {
    form.append(
      field("Query", input({ name: "query", required: true, spellcheck: false }), "grow"),
      field("Glob", input({ name: "glob", placeholder: "*.ts" }), "glob"),
      field("Regex", input({ name: "regex", type: "checkbox" })),
      field("Hidden", input({ name: "hidden", type: "checkbox" })),
    );
  } else if (id === "find") {
    form.append(
      field("Name", input({ name: "pattern", placeholder: "package.json" }), "grow"),
      field("Kind", select("kind", [["any", "any"], ["file", "file"], ["dir", "dir"]]), "select"),
      field("Ext", input({ name: "ext", placeholder: "ts" }), "ext"),
      field("Depth", input({ name: "depth", type: "number", value: "0", min: "0" }), "num"),
      field("Changed", input({ name: "changedWithin", placeholder: "7d" }), "changed"),
    );
  } else if (id === "fuzzy") {
    form.append(
      field("Query", input({ name: "query", id: "fuzzy-query" }), "grow"),
      field("Source", select("source", [["files", "files"], ["dirs", "dirs"]]), "select"),
    );
  } else if (id === "tree") {
    form.append(
      field("Depth", input({ name: "depth", type: "number", value: "2", min: "1", max: "8" }), "num"),
      field("Dirs only", input({ name: "dirsOnly", type: "checkbox" })),
      field("Hidden", Object.assign(input({ name: "hidden", type: "checkbox" }), { checked: true })),
    );
  } else if (id === "doc") {
    form.append(
      field("Command", input({ name: "command", required: true, placeholder: "rg" }), "grow"),
      field("Source", select("source", [["tldr", "tldr"], ["man", "man"]]), "select"),
    );
  } else if (id === "space") {
    form.append();
  } else if (id === "health") {
    showCommand("");
  }
  if (id === "health") {
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Recheck";
    form.append(submit);
    return;
  }
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = id === "space" ? "Analyze" : id.startsWith("ds") || id === "node_modules" || id === "xcode"
    ? "Scan"
    : "Run";
  form.append(submit);
  syncCommandPreview();
}

function syncCommandPreview() {
  const form = $("tool-form");
  if (!form) return;
  showCommand(previewCommand(state.tool, formData(form), state.root));
}

function formData(form) {
  const data = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    data[el.name] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
  }
  return data;
}

function renderHits(hits) {
  const list = document.createElement("ul");
  list.className = "hits";
  for (const hit of hits) {
    const li = document.createElement("li");
    li.className = "hit";
    li.innerHTML = `<span></span><code>${esc(hit.file)}:${hit.line}</code><span class="meta">${esc(hit.text)}</span>`;
    list.append(li);
  }
  $("panel-body").replaceChildren(list);
}

function renderTable(items, opts = {}) {
  state.items = items;
  const body = $("panel-body");
  const actions = document.createElement("div");
  actions.className = "table-actions";
  const all = document.createElement("input");
  all.type = "checkbox";
  all.checked = true;
  all.addEventListener("change", () => {
    body.querySelectorAll("input[data-path]").forEach((box) => {
      box.checked = all.checked;
    });
  });
  const trashBtn = document.createElement("button");
  trashBtn.type = "button";
  trashBtn.className = "danger";
  trashBtn.textContent = "Move selected to Trash";
  trashBtn.addEventListener("click", trashSelected);
  const total = items.reduce((sum, item) => sum + (item.size || 0), 0);
  const summary = document.createElement("span");
  summary.textContent = `${items.length} items${opts.sizes !== false ? ` · ${bytes(total)}` : ""}`;
  actions.append(all, trashBtn, summary);

  const list = document.createElement("ul");
  list.className = "rows";
  for (const item of items) {
    const path = item.path || item;
    const li = document.createElement("li");
    li.className = "row";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = true;
    box.dataset.path = path;
    const code = document.createElement("code");
    code.textContent = path;
    const size = document.createElement("span");
    size.className = "size";
    size.textContent = item.size != null ? bytes(item.size) : "";
    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.textContent = "Reveal";
    reveal.addEventListener("click", () => api("/open", { method: "POST", body: JSON.stringify({ path }) }));
    li.append(box, code, size, reveal);
    list.append(li);
  }
  body.replaceChildren(actions, list);
}

async function trashSelected() {
  const paths = [...document.querySelectorAll("input[data-path]:checked")].map((box) => box.dataset.path);
  if (!paths.length) return;
  if (!confirm(`Move ${paths.length} item(s) to Trash?`)) return;
  const data = await api("/trash", { method: "POST", body: JSON.stringify({ paths }) });
  showCommand(data.command);
  const failed = data.results.filter((row) => !row.ok);
  banner(failed.length ? failed.map((row) => row.error).join("; ") : `Moved ${paths.length} to Trash`);
  if (!failed.length) $("panel-body").replaceChildren();
}

function renderOutput(text) {
  const pre = document.createElement("pre");
  pre.className = "output";
  pre.append(ansiFragment(text));
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "copy-btn";
  copy.textContent = "Copy";
  copy.addEventListener("click", () => navigator.clipboard.writeText(stripAnsi(text)));
  $("panel-body").replaceChildren(copy, pre);
}

function renderSpace(data) {
  const max = Math.max(...data.entries.map((entry) => entry.bytes), 1);
  const wrap = document.createElement("div");
  for (const entry of data.entries) {
    const row = document.createElement("div");
    row.className = "space-row";
    const name = document.createElement(entry.isDir ? "button" : "span");
    name.textContent = entry.name;
    if (entry.isDir) {
      name.type = "button";
      name.addEventListener("click", async () => {
        state.spaceRoot = entry.path;
        runSpace();
      });
    }
    const bar = document.createElement("div");
    bar.className = "space-bar";
    bar.innerHTML = `<span style="width:${(entry.bytes / max) * 100}%"></span>`;
    const size = document.createElement("span");
    size.textContent = bytes(entry.bytes);
    row.append(name, bar, size);
    wrap.append(row);
  }
  $("panel-body").replaceChildren(wrap);
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

async function runSpace() {
  banner("Measuring…");
  showCommand(previewCommand("space", {}, state.spaceRoot || state.root));
  const data = await api("/sizes", {
    method: "POST",
    body: JSON.stringify({ root: state.spaceRoot || state.root }),
  });
  banner("");
  showCommand(data.command);
  renderSpace(data);
}

function commandLine(cmd, args) {
  const token = (value) => (/^[A-Za-z0-9_./:=+@%,-]+$/.test(value) ? value : `'${String(value).replaceAll("'", "'\\''")}'`);
  return [cmd, ...args.map(token)].join(" ");
}

function previewCommand(tool, fields, root) {
  const r = root || "~";
  if (tool === "search") {
    const args = ["--json", "--max-count", "20", "--max-filesize", "2M"];
    if (!fields.regex) args.push("--fixed-strings");
    if (!fields.caseSensitive) args.push("--ignore-case");
    if (fields.hidden) args.push("--hidden");
    if (fields.glob) args.push("--glob", fields.glob);
    args.push("--", fields.query || "", r);
    return commandLine("rg", args);
  }
  if (tool === "find") {
    const args = ["--absolute-path", "--color=never"];
    if (fields.kind === "file") args.push("--type", "f");
    else if (fields.kind === "dir") args.push("--type", "d");
    else if (fields.kind === "symlink") args.push("--type", "l");
    if (fields.ext) args.push("--extension", fields.ext);
    if (fields.hidden) args.push("--hidden");
    if (fields.depth > 0) args.push("--max-depth", String(fields.depth));
    if (fields.changedWithin) args.push("--changed-within", fields.changedWithin);
    args.push("--", fields.pattern || ".", r);
    return commandLine("fd", args);
  }
  if (tool === "fuzzy") {
    const args = ["--absolute-path", "--color=never"];
    args.push("--type", fields.source === "dirs" ? "d" : "f");
    args.push("--", ".", r);
    const fd = commandLine("fd", args);
    if (!fields.query) return fd;
    return `${fd} | ${commandLine("fzf", ["--filter", fields.query, "--no-sort"])}`;
  }
  if (tool === "tree") {
    const args = ["-C", "-L", String(fields.depth || 2), "-F"];
    if (fields.hidden) args.push("-a");
    if (fields.dirsOnly) args.push("-d");
    args.push(r);
    return commandLine("tree", args);
  }
  if (tool === "doc") {
    if (fields.source === "tldr") return commandLine("tldr", ["--color", fields.command || ""]);
    return `${commandLine("man", [fields.command || ""])} | ${commandLine("col", ["-bx"])}`;
  }
  if (tool === "space") return `${commandLine("du", ["-sk"])} ${r}/*`;
  if (tool === "ds_store") return commandLine("find", [r, "-name", ".DS_Store"]);
  if (tool === "node_modules") return commandLine("find", [r, "-type", "d", "-name", "node_modules"]);
  if (tool === "xcode") {
    return commandLine("find", [r, "(", "-name", "DerivedData", "-o", "-name", ".build", ")", "-type", "d"]);
  }
  if (tool === "health") return "";
  return "";
}

$("tool-form").addEventListener("input", syncCommandPreview);
$("tool-form").addEventListener("change", syncCommandPreview);

$("tool-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const fields = formData(event.target);
  const root = state.root;
  banner("Working…");
  if (state.tool !== "health") showCommand(previewCommand(state.tool, fields, root));
  try {
    if (state.tool === "health") {
      await loadHealth();
      renderHealth();
      banner("");
      return;
    }
    if (state.tool === "search") {
      const data = await api("/search", { method: "POST", body: JSON.stringify({ root, ...fields }) });
      if (data.missing) throw new Error(state.tools.rg?.brew || BREW_FALLBACK.rg);
      showCommand(data.command);
      renderHits(data.hits);
      banner(data.truncated ? "Results capped at 2000." : `${data.hits.length} hits`);
    } else if (state.tool === "find") {
      const data = await api("/find", { method: "POST", body: JSON.stringify({ root, ...fields }) });
      if (data.missing) throw new Error(state.tools.fd?.brew || BREW_FALLBACK.fd);
      showCommand(data.command);
      renderTable(data.paths.map((path) => ({ path, size: 0 })), { sizes: false });
      banner(`${data.paths.length} paths`);
    } else if (state.tool === "fuzzy") {
      const data = await api("/fuzzy", { method: "POST", body: JSON.stringify({ root, ...fields }) });
      if (data.missing) throw new Error(state.tools[data.missing]?.brew || BREW_FALLBACK[data.missing]);
      showCommand(data.command);
      renderTable(data.paths.map((path) => ({ path, size: 0 })), { sizes: false });
      banner(`${data.paths.length} paths`);
    } else if (state.tool === "tree") {
      const data = await api("/tree", { method: "POST", body: JSON.stringify({ root, ...fields }) });
      if (data.missing) throw new Error(state.tools.tree?.brew || BREW_FALLBACK.tree);
      showCommand(data.command);
      renderOutput(data.text);
      banner("");
    } else if (state.tool === "doc") {
      const data = await api(
        `/doc?command=${encodeURIComponent(fields.command)}&source=${encodeURIComponent(fields.source)}`,
      );
      if (data.missing) throw new Error(state.tools[fields.source]?.brew || `${fields.source} is missing`);
      showCommand(data.command);
      renderOutput(data.text);
      banner("");
    } else if (state.tool === "space") {
      state.spaceRoot = root;
      await runSpace();
    } else {
      const data = await api("/scan", {
        method: "POST",
        body: JSON.stringify({ root, kind: state.tool }),
      });
      showCommand(data.command);
      renderTable(data.items);
      banner(`${data.items.length} items · ${bytes(data.totalSize)}`);
    }
  } catch (error) {
    banner(error.message);
  }
});

$("browse-open").addEventListener("click", () => {
  $("picker").showModal();
  loadPicker(state.root || "~");
});

$("path-home").addEventListener("click", () => setRoot("~"));

function pickerError(text) {
  const node = $("picker-error");
  node.hidden = !text;
  node.textContent = text || "";
}

$("picker-goto").addEventListener("submit", (event) => {
  event.preventDefault();
  event.stopPropagation();
  chooseFolder($("picker-path").value.trim());
});

function renderRecents() {
  const list = $("picker-recents");
  list.replaceChildren();
  for (const path of recents()) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = path;
    button.addEventListener("click", () => chooseFolder(path));
    li.append(button);
    list.append(li);
  }
}

async function loadPicker(path) {
  pickerError("");
  renderRecents();
  try {
    const view = await api(`/browse?path=${encodeURIComponent(path)}`);
    $("picker-path").value = view.path;
    const list = $("picker-list");
    list.replaceChildren();
    if (view.parent) {
      const up = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "..";
      button.addEventListener("click", () => loadPicker(view.parent));
      up.append(button);
      list.append(up);
    }
    for (const entry of view.entries.filter((item) => item.isDir && !item.hidden)) {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = entry.name;
      button.addEventListener("click", () => loadPicker(entry.path));
      li.append(button);
      list.append(li);
    }
    const choose = document.createElement("li");
    const use = document.createElement("button");
    use.type = "button";
    use.textContent = `Use ${view.path}`;
    use.addEventListener("click", () => chooseFolder(view.path));
    choose.append(use);
    list.prepend(choose);
  } catch (error) {
    pickerError(error.message);
  }
}

async function chooseFolder(path) {
  pickerError("");
  if (!path) {
    pickerError("Enter a folder path");
    return;
  }
  try {
    await setRoot(path);
    $("picker").close();
  } catch (error) {
    pickerError(error.message);
  }
}

async function boot() {
  try {
    await loadHealth();
  } catch (error) {
    banner(error.message);
  }
  renderRail();
  renderForm();
  try {
    await setRoot(recents()[0] || "~");
  } catch (error) {
    banner(error.message);
  }
}

boot();
