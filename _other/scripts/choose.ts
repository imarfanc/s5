import { config } from "./config.ts";
import {
  moveSelection,
  parseMouse,
  pickerRows,
  readTasks,
  taskIndexAtScreenRow,
} from "./choose-lib.ts";
import { accent, bold, fail, hint, hints, muted, padDisplay, rule, screen } from "./style.ts";

/** Two blank-padded header lines precede the first row the mouse can hit. */
const FIRST_ROW = 4;
const GUTTER = "  ";

/** The host repository's own tasks, so `_other/` works dropped into any repo. */
const TASKS = readTasks(config.root);
if (TASKS.length === 0) fail(`no tasks found in ${config.root}deno.json`);

/** Derived, so adding a task never leaves a stale hint or a dead number key. */
const NUMBERED = Math.min(TASKS.length, 9);
const NUMBERS = NUMBERED === 1 ? "1" : `1–${NUMBERED}`;
const NUMBER_KEY = new RegExp(`^[1-${NUMBERED}]$`);

if (Deno.args.includes("--help") || Deno.args.includes("-h")) {
  console.log(`${bold("choose")} — select a primary repository task

${muted("Usage")}
  deno task choose
  deno task choose <${TASKS.map(({ name }) => name).join("|")}>

${muted("Controls")}
  ${bold("↑/↓")} or ${bold("j/k")}   move
  ${bold(NUMBERS)}          run by number
  ${bold("enter")}        run selected
  ${bold("click")}        select; click the selected task to run
  ${bold("wheel")}        move
  ${bold("esc")}/${bold("q")}        cancel`);
  Deno.exit(0);
}

const requested = Deno.args[0];
if (requested) {
  const task = TASKS.find(({ name }) => name === requested);
  if (!task) fail(`unknown task: ${requested}`);
  Deno.exit(await run(task.name));
}

if (!Deno.stdin.isTerminal() || !Deno.stdout.isTerminal()) {
  fail("choose requires a terminal; use `deno task <name>` directly");
}

let selected = 0;
let finished = false;
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const buffer = new Uint8Array(64);
const rows = pickerRows(TASKS);

try {
  Deno.stdin.setRaw(true);
  Deno.stdout.writeSync(encoder.encode(screen.mouseOn));
  render();
  while (!finished) {
    const count = await Deno.stdin.read(buffer);
    if (count === null) break;
    const input = decoder.decode(buffer.subarray(0, count));
    if (input === "\x03" || input === "\x1b" || input === "q") break;
    const mouse = parseMouse(input);
    if (mouse?.kind === "scroll") selected = moveSelection(selected, mouse.delta, TASKS.length);
    else if (mouse?.kind === "click") {
      const clicked = taskIndexAtScreenRow(rows, mouse.row, FIRST_ROW);
      if (clicked !== null) {
        if (clicked === selected) finished = true;
        else selected = clicked;
      }
    } else if (input === "\x1b[A" || input === "k") {
      selected = moveSelection(selected, -1, TASKS.length);
    } else if (input === "\x1b[B" || input === "j") {
      selected = moveSelection(selected, 1, TASKS.length);
    } else if (NUMBER_KEY.test(input)) {
      selected = Number(input) - 1;
      finished = true;
    } else if (input === "\r" || input === "\n") finished = true;
    render();
  }
} finally {
  Deno.stdin.setRaw(false);
  console.log(`${screen.mouseOff}${screen.showCursor}`);
}

if (finished) Deno.exit(await run(TASKS[selected]!.name));

function render(): void {
  const nameWidth = Math.max(...TASKS.map(({ name }) => name.length));
  const descriptionWidth = Math.max(...TASKS.map(({ description }) => description.length));
  const ruleWidth = nameWidth + descriptionWidth + 9;
  const body = rows.map((row) => {
    if (row.kind === "spacer") return "";
    if (row.kind === "heading") return `${GUTTER}${rule(row.group, ruleWidth)}`;
    const active = row.taskIndex === selected;
    const marker = active ? accent("▌") : " ";
    const number = `${row.taskIndex + 1}`;
    const name = padDisplay(row.task.name, nameWidth);
    return `${GUTTER}${marker} ${active ? accent(number) : muted(number)}  ${
      active ? bold(accent(name)) : name
    }  ${muted(row.task.description)}`;
  });
  const heading = `${GUTTER}${bold(accent(config.title))} ${muted("tasks")}`;
  const footer = `${GUTTER}${
    hints(
      hint("↑/↓", "move"),
      hint(NUMBERS, "run"),
      hint("enter", "run selected"),
      hint("click", "select or run"),
      hint("q", "quit"),
    )
  }`;
  console.log(
    `${screen.clear}${screen.hideCursor}\n${heading}\n\n${body.join("\n")}\n\n${footer}`,
  );
}

async function run(name: string): Promise<number> {
  console.log(`\n${muted(`$ deno task ${name}`)}\n`);
  const child = new Deno.Command(Deno.execPath(), {
    args: ["task", name],
    cwd: config.root,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();
  return (await child.status).code;
}
