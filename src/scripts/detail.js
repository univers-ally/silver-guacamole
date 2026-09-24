import { el, escapeHtml } from "./dom.js";
import { openSheet } from "./sheets.js";

let request;
const detailData = () =>
  (request ||= fetch(document.body.dataset.detail)
    .then(response => (response.ok ? response.json() : Promise.reject(Error(response.status))))
    .catch(error => {
      request = null;
      throw error;
    }));

const termsSheet = el("terms");
const termsTitle = el("terms-title");
const termsDate = el("terms-date");
const termsText = termsSheet.querySelector("pre");

export async function openTerms(entry) {
  const codes = [...entry.node.querySelectorAll(".code code")].map(node => node.textContent);
  termsTitle.textContent = codes.length ? `${entry.name} · ${codes.join(" / ")}` : entry.name;
  termsSheet.dataset.for = entry.id;
  termsDate.textContent = "";
  termsText.textContent = "Loading rules…";
  termsText.scrollTop = 0;
  openSheet(termsSheet);

  let record;
  try {
    record = (await detailData()).t[entry.id];
  } catch {}
  if (termsSheet.dataset.for !== entry.id) return; // another sheet was opened meanwhile
  if (!record) {
    termsText.textContent = "Could not load the rules. Check your connection and try again.";
    return;
  }
  termsDate.textContent = record.u;
  // plain text, except for the odd <table> a summary carries as markup
  termsText.innerHTML = record.t
    .split(/(<table[\s\S]*?<\/table>)\n?/)
    .map((part, i) => (i % 2 ? part : escapeHtml(part)))
    .join("");
  termsText.scrollTop = 0;
}

const calcSheet = el("calc");
const calcTitle = el("calc-title");
const calcBody = el("calc-body");

export async function openCalc(entry) {
  calcTitle.textContent = entry.name;
  calcSheet.dataset.for = entry.id;
  calcBody.innerHTML = `<p class="calc-note">Loading…</p>`;
  openSheet(calcSheet);

  try {
    const [calc, data] = await Promise.all([import("./calc.js"), detailData()]);
    if (calcSheet.dataset.for !== entry.id) return;
    const config = data.c[entry.id];
    if (!config) throw Error("no calculator for " + entry.id);
    calc.render(calcBody, config, entry.id);
  } catch {
    if (calcSheet.dataset.for === entry.id) {
      calcBody.innerHTML = `<p class="calc-note">Could not load the calculator. Check your connection and try again.</p>`;
    }
  }
}
