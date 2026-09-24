import { RATING, FACETS } from "../lib/vocab.js";
import { el, delegate, h, countText, setPressed, isTyping } from "./dom.js";
import { store } from "./store.js";
import { toast, confetti } from "./feedback.js";
import { openSheet } from "./sheets.js";
import { showTab, currentTab } from "./tabs.js";
import { openTerms, openCalc } from "./detail.js";

const PARAM = Object.fromEntries(Object.entries(FACETS).map(([facet, { attr }]) => [facet, attr]));
const RATING_RANK = Object.keys(RATING); // best first

const list = el("list");
const count = el("count");
const empty = list.querySelector(".empty");
const searchInput = el("q");
const sortSelect = el("sort");
const facetChips = el("facets");
const activePills = el("active");
const filterButton = el("filter-btn");
const filterBadge = el("filter-count");
const filterSheet = el("filters");
const filterBody = el("filter-body");
const filterApply = el("filter-apply");

const searchTerm = () => searchInput.value.trim().toLowerCase();

/* ---------- cards ---------- */

const entries = [...list.querySelectorAll(".promo")].map((node, index) => {
  const name = node.querySelector(".toggle").textContent;
  const shown = [...node.querySelectorAll(".code code, .reward, .rules li")].map(
    part => part.textContent,
  );
  return {
    node,
    index,
    name,
    id: node.dataset.id,
    text: [name, node.dataset.s || "", ...shown].join(" ").toLowerCase(),
  };
});
export const byId = new Map(entries.map(entry => [entry.id, entry]));

/* ---------- state ---------- */

// a filter is "facet|value", or "fav"
let filters = new Set();
let draftFilters = null; // the Filters sheet edits a copy until Apply
let sortMode = "default";
let focusId = null; // ?id= share link

let favorites = new Set();
try {
  favorites = new Set(JSON.parse(store.get("favs") || "[]"));
} catch {}
let favoriteHintShown = !!store.get("favhint");

const filterKey = (facet, value) => facet + "|" + value;
const toggle = (set, key) => set.delete(key) || set.add(key);
const selectedValues = (set, facet) =>
  [...set].filter(key => key.startsWith(facet + "|")).map(key => key.slice(facet.length + 1));

const LABELS = new Map();
for (const group of facetChips.querySelectorAll(".facet")) {
  const legend = group.querySelector("legend").textContent;
  for (const chip of group.querySelectorAll(".chip")) {
    const key = chip.dataset.key;
    LABELS.set(key, key === "fav" ? "Favorites only" : `${legend}: ${chip.textContent.trim()}`);
  }
}

/* ---------- url ---------- */

function readUrl() {
  const params = new URLSearchParams(location.search);
  focusId = params.get("id");
  for (const facet in PARAM) {
    for (const value of (params.get(PARAM[facet]) || "").split(",")) {
      const key = filterKey(facet, value);
      if (LABELS.has(key)) filters.add(key);
    }
  }
  if (params.get("fav") === "1") filters.add("fav");
  const sort = params.get("sort");
  if (sort && [...sortSelect.options].some(option => option.value === sort)) sortMode = sort;
  sortSelect.value = sortMode;
}

export function syncUrl() {
  const params = new URLSearchParams();
  if (focusId) params.set("id", focusId);
  for (const facet in PARAM) {
    const values = selectedValues(filters, facet);
    if (values.length) params.set(PARAM[facet], values.join(","));
  }
  if (filters.has("fav")) params.set("fav", "1");
  if (sortMode !== "default") params.set("sort", sortMode);
  const query = params.toString();
  const hash = currentTab() === "promos" ? "" : "#" + currentTab();
  try {
    history.replaceState(null, "", location.pathname + (query ? "?" + query : "") + hash);
  } catch {}
}

/* ---------- matching and order ---------- */

function matchesSearch(entry, term) {
  if (!term) return true;
  return entry.text.includes(term) || RATING[entry.node.dataset.r].words.includes(term);
}

function passesFilters(entry, set) {
  if (set.has("fav") && !favorites.has(entry.id)) return false;
  for (const facet in PARAM) {
    const wanted = selectedValues(set, facet);
    if (!wanted.length) continue;
    const has = (entry.node.dataset[PARAM[facet]] || "").split(",");
    if (!wanted.some(value => has.includes(value))) return false;
  }
  return true;
}

// favorites first, then the chosen order
function orderedEntries() {
  const byIndex = (a, b) => a.index - b.index;
  const rank = entry => RATING_RANK.indexOf(entry.node.dataset.r);
  const compare = {
    default: byIndex,
    rating: (a, b) => rank(a) - rank(b) || byIndex(a, b),
    name: (a, b) => a.name.localeCompare(b.name),
  }[sortMode];
  const favoritesFirst = (a, b) => favorites.has(b.id) - favorites.has(a.id);
  return [...entries].sort((a, b) => favoritesFirst(a, b) || compare(a, b));
}

/* ---------- card behavior ---------- */

function setOpen(card, open, auto) {
  card.classList.toggle("open", open);
  card.querySelector(".toggle").setAttribute("aria-expanded", open);
  if (auto) card.dataset.auto = "1";
  else delete card.dataset.auto;
}

function refreshFavoriteButton(entry) {
  const on = favorites.has(entry.id);
  const button = entry.node.querySelector(".fav");
  button.classList.toggle("on", on);
  button.setAttribute("aria-pressed", on);
  button.setAttribute(
    "aria-label",
    on ? `Remove ${entry.name} from favorites` : `Add ${entry.name} to favorites`,
  );
}

function toggleFavorite(entry, button) {
  if (favorites.has(entry.id)) {
    favorites.delete(entry.id);
  } else {
    favorites.add(entry.id);
    confetti(button);
  }
  store.set("favs", JSON.stringify([...favorites]));
  refreshFavoriteButton(entry);
  if (!favoriteHintShown && favorites.size) {
    favoriteHintShown = true;
    store.set("favhint", "1");
    toast("Favorites are saved on this device only");
  }
  render();
}

let copyTick = 0;

export async function copyCode(button) {
  const label = (button.dataset.label ||= button.getAttribute("aria-label"));
  try {
    await navigator.clipboard.writeText(button.dataset.code);
  } catch {
    toast("Couldn't copy. Select the code and copy it by hand");
    return;
  }
  toast("Code copied");
  button.textContent = "Copied";
  button.setAttribute("aria-label", "Copied");
  button.classList.add("done");
  confetti(button);
  const tap = (button.dataset.tap = String(++copyTick));
  setTimeout(() => {
    if (button.dataset.tap !== tap) return;
    button.textContent = "Copy";
    button.setAttribute("aria-label", label);
    button.classList.remove("done");
  }, 1500);
}

function onCardClick(event, entry) {
  const card = entry.node;
  const hit = selector => event.target.closest(selector);
  const copy = hit(".code button");
  const favorite = hit(".fav");
  const opener = hit("[data-open]"); // Rules / Calculator
  const tabLink = hit(".go");

  if (hit(".toggle, .chevbtn")) {
    const open = !card.classList.contains("open");
    setOpen(card, open);
    if (open) delete card.dataset.shut;
    else card.dataset.shut = "1";
  } else if (copy) {
    copyCode(copy);
  } else if (favorite) {
    toggleFavorite(entry, favorite);
  } else if (opener) {
    if (opener.dataset.open === "calc") openCalc(entry);
    else openTerms(entry);
  } else if (tabLink) {
    showTab(tabLink.dataset.tab, true);
    scrollTo(0, 0);
  }
}

/* ---------- rendering ---------- */

function render() {
  const term = searchTerm();
  const visible = [];
  const focused = document.activeElement;

  for (const entry of orderedEntries()) {
    const card = entry.node;
    const shown = passesFilters(entry, filters) && matchesSearch(entry, term);
    card.hidden = !shown;
    if (!shown) continue;
    visible.push(card);
    if (!term) delete card.dataset.shut;
    if (term && !card.dataset.shut && !card.classList.contains("open")) setOpen(card, true, true);
    else if (!term && card.dataset.auto) setOpen(card, false);
  }

  visible.forEach((card, index) => {
    if (list.children[index] !== card) list.insertBefore(card, list.children[index] || null);
  });
  list.appendChild(empty);
  if (focused?.isConnected) {
    if (focused.closest(".promo[hidden]")) searchInput.focus({ preventScroll: true });
    else if (focused !== document.activeElement) focused.focus({ preventScroll: true });
  }

  empty.hidden = visible.length > 0;
  count.textContent = countText(visible.length, entries.length, "promos");

  const active = filters.size;
  filterBadge.hidden = !active;
  filterBadge.textContent = active;
  filterButton.classList.toggle("on", active > 0);
  filterButton.setAttribute("aria-label", active ? `Filters, ${active} active` : "Filters");

  renderPills();
  syncChips(facetChips, filters);
}

function syncChips(container, set) {
  for (const chip of container.querySelectorAll(".chip"))
    setPressed(chip, set.has(chip.dataset.key));
}

function renderPills() {
  const keys = [...LABELS.keys()].filter(key => filters.has(key));
  const pill = key => {
    const label = LABELS.get(key);
    const remove = { type: "button", "data-key": key, "aria-label": `Remove filter ${label}` };
    return h("span", { class: "pill" }, label, h("button", remove, "✕"));
  };
  activePills.hidden = !keys.length;
  activePills.replaceChildren(
    ...keys.map(pill),
    keys.length > 0 && h("button", { type: "button", class: "clear" }, "Clear all"),
  );
}

function paintFilterSheet() {
  syncChips(filterBody, draftFilters);
  const term = searchTerm();
  const matching = entries.filter(
    entry => passesFilters(entry, draftFilters) && matchesSearch(entry, term),
  ).length;
  filterApply.textContent = draftFilters.size
    ? `Show ${matching} promo${matching === 1 ? "" : "s"}`
    : "Show all promos";
}

/* ---------- wiring ---------- */

function setUpFilters() {
  const apply = () => {
    render();
    syncUrl();
  };
  delegate(activePills, ".pill button", button => {
    toggle(filters, button.dataset.key);
    apply();
  });
  delegate(activePills, ".clear", () => {
    filters = new Set();
    apply();
  });
  delegate(facetChips, ".chip", chip => {
    toggle(filters, chip.dataset.key);
    apply();
  });
  sortSelect.addEventListener("change", () => {
    sortMode = sortSelect.value;
    apply();
  });

  delegate(filterBody, ".chip", chip => {
    toggle(draftFilters, chip.dataset.key);
    paintFilterSheet();
  });
  filterButton.addEventListener("click", () => {
    draftFilters = new Set(filters);
    paintFilterSheet();
    openSheet(filterSheet);
    filterButton.setAttribute("aria-expanded", "true");
  });
  el("filter-reset").addEventListener("click", () => {
    draftFilters = new Set();
    paintFilterSheet();
  });
  filterApply.addEventListener("click", () => {
    filters = draftFilters;
    filterSheet.close();
    apply();
  });
  filterSheet.addEventListener("close", () => filterButton.setAttribute("aria-expanded", "false"));
}

function setUpSearch() {
  let timer;
  searchInput.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(render, 80);
  });

  // "/" jumps to the search box from anywhere
  document.addEventListener("keydown", event => {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping() || document.querySelector("dialog[open]")) return;
    event.preventDefault();
    showTab("promos", true);
    searchInput.focus();
  });
}

export function setUpPromos() {
  setUpFilters();
  setUpSearch();
  delegate(list, ".promo", (card, event) => onCardClick(event, byId.get(card.dataset.id)));
  entries.forEach(refreshFavoriteButton);
  readUrl();

  // A share link (?id=) opens that one card with nothing filtering it out,
  // then drops the id so a reload behaves like a normal visit.
  const shared = byId.get(focusId);
  focusId = null;
  if (shared) {
    filters = new Set();
    searchInput.value = "";
    showTab("promos");
    render();
    setOpen(shared.node, true);
    requestAnimationFrame(() => shared.node.scrollIntoView({ block: "start" }));
    syncUrl();
  } else {
    showTab(location.hash.slice(1));
    render();
  }
}
