/* promo calculators. loaded on demand, only when a Calculator button is tapped */
import { escapeHtml } from "./dom.js";
import { store } from "./store.js";

const PIP = { b: "🔵", y: "🟡" };

/* ---------- formatting ---------- */

const group = whole => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const dollars = (value, keepCents) => {
  if (!isFinite(value) || Math.abs(value) >= 1e21) return "—";
  const [whole, cents] = Math.abs(value).toFixed(2).split(".");
  return (value < 0 ? "-$" : "$") + group(whole) + (keepCents || cents !== "00" ? "." + cents : "");
};

// "$1,234.56", whole dollars left bare so Temu's own "+ $1" wording survives
const money = value => dollars(value, false);

// "$350.00", for lines quoting a balance, where bare dollars read as a typo
const money2 = value => dollars(value, true);

const num = value => {
  if (!isFinite(value)) return "—";
  const [whole, rest] = String(Math.round(value * 1e4) / 1e4).split(".");
  return group(whole) + (rest ? "." + rest : "");
};

// what `fmt` on a calc selects for a numeric result
const FORMAT = { money, money2 };

/* ---------- expressions ---------- */

//   numbers        1  0.5
//   strings        "text", with \" and \\ escapes
//   names          any field key or derived name
//   grouping       ( )
//   unary          !a  -a
//   arithmetic     * / %  then  + -   (+ also joins strings)
//   comparison     < <= > >=  then  == !=
//   logic          &&  then  ||
//   choice         a ? b : c
//   calls          min(a, b)  max(a, b)  ceil(a)  floor(a)  round(a)  abs(a)
//                  finite(a)  $(a) money  $$(a) money with cents  num(a) plain

const FUNCTIONS = {
  min: Math.min,
  max: Math.max,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  abs: Math.abs,
  finite: Number.isFinite,
  $: money,
  $$: money2,
  num,
};

const BINARY = [
  { "||": (a, b) => a || b },
  { "&&": (a, b) => a && b },
  { "==": (a, b) => a === b, "!=": (a, b) => a !== b },
  { "<": (a, b) => a < b, "<=": (a, b) => a <= b, ">": (a, b) => a > b, ">=": (a, b) => a >= b },
  { "+": (a, b) => a + b, "-": (a, b) => a - b },
  { "*": (a, b) => a * b, "/": (a, b) => a / b, "%": (a, b) => a % b },
];

const TOKEN =
  /\s*(?:(\d+(?:\.\d+)?)|("(?:[^"\\]|\\.)*")|([A-Za-z_$][\w$]*)|(<=|>=|==|!=|&&|\|\||[-+*/%<>!?:(),]))/y;

function tokenize(source) {
  const tokens = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < source.length) {
    const at = TOKEN.lastIndex;
    const m = TOKEN.exec(source);
    if (!m || m.index !== at) {
      if (!source.slice(at).trim()) break;
      throw SyntaxError(`unexpected "${source.slice(at, at + 10)}"`);
    }
    if (m[1] !== undefined) tokens.push({ n: Number(m[1]) });
    else if (m[2] !== undefined) tokens.push({ s: JSON.parse(m[2]) });
    else if (m[3] !== undefined) tokens.push({ id: m[3] });
    else tokens.push(m[4]);
  }
  return tokens;
}

const describe = token =>
  token === undefined
    ? "end"
    : typeof token === "string"
      ? token
      : JSON.stringify(token.n ?? token.s ?? token.id);

function compile(source) {
  const tokens = tokenize(source);
  let i = 0;
  const peek = () => tokens[i];
  const take = expected => {
    const token = tokens[i++];
    if (expected !== undefined && token !== expected)
      throw SyntaxError(`expected ${expected}, got ${describe(token)}`);
    return token;
  };

  const choice = () => {
    const test = binary(0);
    if (peek() !== "?") return test;
    take();
    const yes = choice();
    take(":");
    const no = choice();
    return scope => (test(scope) ? yes(scope) : no(scope));
  };

  const binary = level => {
    if (level === BINARY.length) return unary();
    let left = binary(level + 1);
    while (BINARY[level][peek()]) {
      const apply = BINARY[level][take()];
      const right = binary(level + 1);
      const before = left;
      left = scope => apply(before(scope), right(scope));
    }
    return left;
  };

  const unary = () => {
    if (peek() === "!") {
      take();
      const value = unary();
      return scope => !value(scope);
    }
    if (peek() === "-") {
      take();
      const value = unary();
      return scope => -value(scope);
    }
    return primary();
  };

  const primary = () => {
    const token = take();
    if (token === "(") {
      const inner = choice();
      take(")");
      return inner;
    }
    if (typeof token !== "object") throw SyntaxError(`unexpected ${describe(token)}`);
    if (token.n !== undefined) return () => token.n;
    if (token.s !== undefined) return () => token.s;
    if (peek() !== "(") {
      const name = token.id;
      return scope => {
        if (!Object.hasOwn(scope, name)) throw ReferenceError(name);
        return scope[name];
      };
    }
    const fn = FUNCTIONS[token.id];
    if (!fn) throw SyntaxError(`unknown function ${token.id}`);
    take("(");
    const args = [];
    while (peek() !== ")") {
      args.push(choice());
      if (peek() === ",") take();
    }
    take(")");
    return scope => fn(...args.map(arg => arg(scope)));
  };

  const expression = choice();
  if (i < tokens.length) throw SyntaxError(`unexpected ${describe(tokens[i])}`);
  return expression;
}

const compileSafely = source => {
  try {
    return compile(source);
  } catch {
    return () => NaN;
  }
};
const evaluate = (fn, scope) => {
  try {
    return fn(scope);
  } catch {
    return NaN;
  }
};

// {key} and ${key} both drop in the field's current value, the $ is literal.
// {=name} drops in a derived value as money, {=name:2} keeps the cents,
// {=name:n} leaves it a plain number.
const DERIVED = { "": money, 2: money2, n: num };

const fill = (line, raw, derived) =>
  escapeHtml(line)
    .replace(
      /\{=(\w+)(?::(\w+))?\}/g,
      (_, name, as) => `<b>${(DERIVED[as || ""] || money)(derived[name])}</b>`,
    )
    .replace(/\{(\w+)\}/g, (_, name) => `<b>${escapeHtml(raw[name] ?? "")}</b>`);

/* ---------- saved values ---------- */

const load = key => {
  try {
    return JSON.parse(store.get(key)) || {};
  } catch {
    return {};
  }
};

const save = (key, values) => store.set(key, JSON.stringify(values));
const forget = key => store.drop(key);

/* ---------- markup ---------- */

// a check field is on for anything but "0" and the empty string
const isOn = value => value !== "0" && value !== "" && value !== undefined && value !== null;

function inputHtml(field, value, captioned) {
  const key = escapeHtml(field.k);
  const aria = captioned ? "" : ` aria-label="${escapeHtml(field.label)}"`;
  if (field.type === "check") {
    return `<input type="checkbox" data-k="${key}"${isOn(value) ? " checked" : ""}${aria}>`;
  }
  // nothing here is ever meaningfully negative, so the spinner stops at zero
  return `<input type="number" inputmode="decimal" min="0" step="${escapeHtml(field.step || "any")}" data-k="${key}" value="${escapeHtml(value)}"${aria}>`;
}

function fieldsHtml(fields, start) {
  // a check reads box-then-label, so it gets its own full-width row
  const one = field =>
    field.type === "check"
      ? `<label class="calc-check">${inputHtml(field, start[field.k], true)}<span>${escapeHtml(field.label)}</span></label>`
      : `<label>${escapeHtml(field.label)}${inputHtml(field, start[field.k], true)}</label>`;
  return `<div class="calc-fields">${fields
    .map(
      field => `
        ${one(field)}`,
    )
    .join("")}
      </div>`;
}

// a field carrying row starts a new row, the ones after it share that row
function rowsHtml(fields, start) {
  const rows = [];
  for (const field of fields) {
    if (field.row || !rows.length)
      rows.push({
        label: field.row || "",
        fields: [],
      });
    rows[rows.length - 1].fields.push(field);
  }
  const mark = field =>
    field.icon
      ? `<span class="calc-mark calc-pip lbl" title="${escapeHtml(field.label)}">${PIP[field.icon] || ""}</span>`
      : `<span class="calc-mark lbl">${escapeHtml(field.tag || "")}</span>`;

  return `<div class="calc-rows">${rows
    .map(
      row => `
        <div class="calc-row" data-cols="${row.fields.length}">
          <span class="calc-row-label lbl">${escapeHtml(row.label)}</span>${row.fields
            .map(
              field => `
          <label class="calc-cell">${mark(field)}${inputHtml(field, start[field.k], false)}</label>`,
            )
            .join("")}
        </div>`,
    )
    .join("")}
      </div>`;
}

/* ---------- render ---------- */

export function render(body, calc, id) {
  const keys = calc.fields.map(field => field.k);
  const store = "calc:" + id;
  const saved = load(store);

  // saved numbers only survive while the promo still has the field they belong to
  const start = {};
  for (const field of calc.fields) start[field.k] = saved[field.k] ?? field.value;

  const formula = compileSafely(calc.f);
  const hint = calc.hint ? compileSafely(calc.hint) : null;
  const derived = Object.entries(calc.derived || {}).map(([name, source]) => [
    name,
    compileSafely(source),
  ]);
  const format = FORMAT[calc.fmt] || money;

  // a tpl entry is a plain line, or an array of cells. consecutive arrays of
  // equal width share one grid, so their columns line up like a real table.
  // lines is every cell in document order, which is the order the nodes come
  // back in below
  const lines = [];
  const groups = []; // { cols, cells }: cols 0 is a plain line
  for (const entry of calc.tpl || []) {
    const cells = Array.isArray(entry) ? entry : [entry];
    const cols = Array.isArray(entry) ? entry.length : 0;
    lines.push(...cells);
    const last = groups[groups.length - 1];
    if (cols && last && last.cols === cols) last.cells += cells.length;
    else groups.push({ cols, cells: cells.length });
  }
  const tplHtml = groups
    .map(({ cols, cells }) => {
      const empty = "<div></div>".repeat(cells);
      return cols ? `<div class="calc-cols" data-cols="${cols}">${empty}</div>` : empty;
    })
    .join("");

  body.innerHTML = [
    calc.note ? `<p class="calc-note">${calc.note}</p>` : "",
    calc.formula ? `<p class="calc-formula">${calc.formula}</p>` : "",
    tplHtml ? `<div class="calc-tpl">${tplHtml}</div>` : "",
    calc.rows ? rowsHtml(calc.fields, start) : fieldsHtml(calc.fields, start),
    `<div class="calc-out">
          <div class="calc-out-main">${calc.out ? `<span>${escapeHtml(calc.out)}</span>` : ""}<output></output></div>
          <p class="calc-hint" aria-live="polite" hidden></p>
        </div>`,
    `<div class="calc-actions"><button type="button" class="reset">Reset to defaults</button></div>`,
  ].join("");
  // grid widths go in through the CSSOM: the CSP allows no style attributes
  for (const node of body.querySelectorAll("[data-cols]"))
    node.style.setProperty("--cols", node.dataset.cols);

  const inputs = [...body.querySelectorAll("input")];
  const output = body.querySelector("output");
  const hintNode = body.querySelector(".calc-hint");
  const lineNodes = [...body.querySelectorAll(".calc-tpl > div:not(.calc-cols), .calc-cols > div")];

  const held = input =>
    input.type === "checkbox"
      ? input.checked
        ? "1"
        : "0"
      : input.value.trim() === ""
        ? "0"
        : input.value;
  const current = () => Object.fromEntries(inputs.map((input, i) => [keys[i], held(input)]));

  const update = () => {
    const raw = current();
    const scope = Object.fromEntries(keys.map(key => [key, parseFloat(raw[key])]));
    for (const [name, fn] of derived) scope[name] = evaluate(fn, scope);
    lineNodes.forEach((node, i) => (node.innerHTML = fill(lines[i], raw, scope)));

    // plain results, number or text, are the headline and stay bold. only a
    // result carrying its own markup drops to normal weight so <b> can emphasise
    const result = evaluate(formula, scope);
    const text = typeof result === "number" ? format(result) : String(result);
    output.classList.toggle("rich", /<[a-z]/i.test(text));
    output.innerHTML = text;

    const note = hint ? evaluate(hint, scope) : "";
    hintNode.innerHTML = typeof note === "string" ? note : "";
    hintNode.hidden = !hintNode.innerHTML;
  };

  const persist = () => save(store, current());

  // a field carrying `dp` settles to that many decimals once you leave it, so
  // "50" becomes "50.00". done on blur, never mid-keystroke
  const settle = () => {
    let moved = false;
    inputs.forEach((input, i) => {
      const dp = calc.fields[i].dp;
      if (dp === undefined || input.type === "checkbox" || input.value.trim() === "") return;
      const value = parseFloat(input.value);
      if (!isFinite(value)) return;
      const fixed = value.toFixed(Number(dp));
      if (fixed !== input.value) {
        input.value = fixed;
        moved = true;
      }
    });
    return moved;
  };

  body.oninput = () => {
    update();
    persist();
  };

  // onblur per input, not onfocusout on the body: focusout has no handler
  // property, and the inputs are rebuilt each render so nothing stacks up
  for (const input of inputs) {
    input.onblur = () => {
      if (settle()) {
        update();
        persist();
      }
    };
  }

  body.querySelector(".reset").onclick = () => {
    inputs.forEach((input, i) => {
      if (input.type === "checkbox") input.checked = isOn(calc.fields[i].value);
      else input.value = calc.fields[i].value;
    });
    forget(store);
    settle();
    update();
  };

  settle();
  update();
}
