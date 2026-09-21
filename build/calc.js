/* promo calculators. loaded on demand, only when a Calculator button is tapped */

const escapeHtml = text => String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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

// {key} and ${key} both drop in the field's current value, the $ is literal.
// {=name} drops in a derived value as money, {=name:2} keeps the cents,
// {=name:n} leaves it a plain number.
const DERIVED = { "": money, 2: money2, n: num };

const fill = (line, raw, derived) => escapeHtml(line)
    .replace(/\{=(\w+)(?::(\w+))?\}/g, (_, name, as) => `<b>${(DERIVED[as || ""] || money)(derived[name])}</b>`)
    .replace(/\{(\w+)\}/g, (_, name) => `<b>${escapeHtml(raw[name] ?? "")}</b>`);

/* ---------- saved values ---------- */

const load = key => {
    try {
        return JSON.parse(localStorage.getItem(key)) || {};
    } catch {
        return {};
    }
};

const save = (key, values) => {
    try {
        localStorage.setItem(key, JSON.stringify(values));
    } catch { }
};

const forget = key => {
    try {
        localStorage.removeItem(key);
    } catch { }
};

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
    const one = field => field.type === "check"
        ? `<label class="calc-check">${inputHtml(field, start[field.k], true)}<span>${escapeHtml(field.label)}</span></label>`
        : `<label>${escapeHtml(field.label)}${inputHtml(field, start[field.k], true)}</label>`;
    return `<div class="calc-fields">${fields.map(field => `
        ${one(field)}`).join("")}
      </div>`;
}

// a field carrying row starts a new row, the ones after it share that row
function rowsHtml(fields, start) {
    const rows = [];
    for (const field of fields) {
        if (field.row || !rows.length) rows.push({
            label: field.row || "",
            fields: []
        });
        rows[rows.length - 1].fields.push(field);
    }
    const mark = field => field.icon ?
        `<span class="calc-mark calc-pip" title="${escapeHtml(field.label)}">${PIP[field.icon] || ""}</span>` :
        `<span class="calc-mark">${escapeHtml(field.tag || "")}</span>`;

    return `<div class="calc-rows">${rows.map(row => `
        <div class="calc-row" style="--cols:${row.fields.length}">
          <span class="calc-row-label">${escapeHtml(row.label)}</span>${row.fields.map(field => `
          <label class="calc-cell">${mark(field)}${inputHtml(field, start[field.k], false)}</label>`).join("")}
        </div>`).join("")}
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

    // expressions are written against the field keys, plus the formatters:
    // $() money, $$() money keeping the cents, num() a plain number
    const compile = expression => {
        try {
            return new Function(...keys, "$", "$$", "num", `return (${expression});`);
        } catch {
            return () => NaN;
        }
    };
    const call = (fn, values) => {
        try {
            return fn(...values, money, money2, num);
        } catch {
            return NaN;
        }
    };

    const formula = compile(calc.f);
    const hint = calc.hint ? compile(calc.hint) : null;
    const derived = Object.entries(calc.derived || {}).map(([name, expression]) => [name, compile(expression)]);
    const format = FORMAT[calc.fmt] || money;

    // a tpl entry is a plain line, or an array of cells. consecutive arrays of
    // equal width share one grid, so their columns line up like a real table
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
    const tplHtml = groups.map(({ cols, cells }) => {
        const empty = "<div></div>".repeat(cells);
        return cols ? `<div class="calc-cols" style="--cols:${cols}">${empty}</div>` : empty;
    }).join("");

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

    const inputs = [...body.querySelectorAll("input")];
    const output = body.querySelector("output");
    const hintNode = body.querySelector(".calc-hint");
    const lineNodes = [...body.querySelectorAll(".calc-tpl > div:not(.calc-cols), .calc-cols > div")];

    // what each input currently holds, as typed. a check enters as "1" or "0",
    // so `lt ? a : b` works like any other field, and an empty box counts as
    // zero rather than blanking the whole panel mid-edit
    const held = input => input.type === "checkbox" ? (input.checked ? "1" : "0")
        : input.value.trim() === "" ? "0" : input.value;
    const current = () => Object.fromEntries(inputs.map((input, i) => [keys[i], held(input)]));

    const update = () => {
        const raw = current();
        const values = keys.map(key => parseFloat(raw[key]));

        const computed = {};
        for (const [name, fn] of derived) computed[name] = call(fn, values);
        lineNodes.forEach((node, i) => node.innerHTML = fill(lines[i], raw, computed));

        // plain results, number or text, are the headline and stay bold. only a
        // result carrying its own markup drops to normal weight so <b> can emphasise
        const result = call(formula, values);
        const text = typeof result === "number" ? format(result) : String(result);
        output.classList.toggle("rich", /<[a-z]/i.test(text));
        output.innerHTML = text;

        const note = hint ? call(hint, values) : "";
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
