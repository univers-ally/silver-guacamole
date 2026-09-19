/* ---------- helpers ---------- */

const el = id => document.getElementById(id);

function delegate(root, selector, handler) {
    root.addEventListener("click", event => {
        const hit = event.target.closest(selector);
        if (hit && root.contains(hit)) handler(hit, event);
    });
}

const escapeHtml = text => String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const isTouch = matchMedia("(hover: none)").matches;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const ICON = {
    calc: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01"/></svg>`,
    chevron: `<span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>`,
    star: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/></svg>`,
    share: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M5 13v6h14v-6"/></svg>`,
    link: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>`,
    rules: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/></svg>`,
};

const RATING = {
    good: {
        emoji: "🔥",
        label: "Worth doing",
        words: "good fire worth"
    },
    meh: {
        emoji: "💤",
        label: "Average or low reward",
        words: "meh average low zzz sleep"
    },
    bad: {
        emoji: "💀",
        label: "Bad deal / scammy",
        words: "bad skull scam avoid"
    },
};
const RATING_ORDER = {
    good: 0,
    meh: 1,
    bad: 2
};

const FACETS = {
    rating: {
        label: "Rating",
        param: "r",
        options: [{
            value: "good",
            label: "🔥 Worth it"
        }, {
            value: "meh",
            label: "💤 Meh"
        }, {
            value: "bad",
            label: "💀 Avoid"
        }]
    },
    payout: {
        label: "Payout",
        param: "p",
        options: ["Cash", "Credit", "Coupons", "Discount", "Gift"].map(v => ({
            value: v,
            label: v
        }))
    },
    accepts: {
        label: "Accepts",
        param: "a",
        options: ["Credit", "Coupons", "Discounts", "None"].map(v => ({
            value: v,
            label: v
        }))
    },
    type: {
        label: "Type",
        param: "t",
        options: ["Daily claim", "Cashout", "Coupon Bundle"].map(v => ({
            value: v,
            label: v
        }))
    },
};
if (!PROMOS.some(promo => promo.accepts && promo.accepts.length)) delete FACETS.accepts;

const ratingOf = promo => promo.rating || "meh";
const screenshotsOf = promo => promo.images || (promo.image ? [{
    src: promo.image
}] : []);
const isFarmland = promo => promo.id === "farmland";
const CALC_READY = new Set(["claimcredit"]);
const hasCalc = promo => !!promo.calc && CALC_READY.has(promo.id);

const promoList = el("list");
const promoCount = el("count");
const searchInput = el("q");
const sortSelect = el("sort");
const filterButton = el("filter-btn");
const filterSheet = el("filters");
const termsSheet = el("terms");
const calcSheet = el("calc");
const lightbox = el("lightbox");

/* ---------- toast ---------- */

let toastTimer;

function toast(message) {
    const box = el("toast");
    box.textContent = message;
    box.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("show"), 2200);
}

/* ---------- theme ---------- */

const THEMES = ["auto", "light", "dark", "oled"];
const THEME_NAMES = {
    auto: "Auto",
    light: "Light",
    dark: "Dark",
    oled: "Ultra Dark"
};

function setUpTheme() {
    const button = el("theme");
    const root = document.documentElement;
    const current = () => THEMES.includes(root.dataset.theme) ? root.dataset.theme : "auto";
    const label = () => {
        const text = "Theme: " + THEME_NAMES[current()];
        button.setAttribute("aria-label", text);
        button.title = text;
    };

    button.addEventListener("click", () => {
        const next = THEMES[(THEMES.indexOf(current()) + 1) % THEMES.length];
        if (next === "auto") delete root.dataset.theme;
        else root.dataset.theme = next;
        if (next === "auto") store.drop("theme");
        else store.set("theme", next);
        label();
        toast("Theme: " + THEME_NAMES[next]);
    });

    label();
}

/* ---------- favorites ---------- */

const store = {
    get: key => {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    set: (key, value) => {
        try {
            localStorage.setItem(key, value);
        } catch {}
    },
    drop: key => {
        try {
            localStorage.removeItem(key);
        } catch {}
    },
};

let favorites = new Set();
try {
    favorites = new Set(JSON.parse(store.get("favs") || "[]"));
} catch {}
let favoriteHintShown = !!store.get("favhint");

/* ---------- tabs ---------- */

const TABS = ["promos", "sellers", "tips", "farmland"];
const scrollPositions = {};
let currentTab = "promos";

function showTab(id, fromUser) {
    if (!TABS.includes(id)) id = "promos";
    scrollPositions[currentTab] = scrollY;
    for (const tab of TABS) {
        el(tab).hidden = tab !== id;
        const button = el("tab-" + tab);
        button.setAttribute("aria-selected", tab === id);
        button.tabIndex = tab === id ? 0 : -1;
    }
    currentTab = id;
    if (fromUser) {
        syncUrl();
        scrollTo(0, scrollPositions[id] || 0);
    }
}

function setUpTabs() {
    for (const tab of TABS) {
        const button = el("tab-" + tab);
        button.addEventListener("click", () => showTab(tab, true));
        button.addEventListener("keydown", event => {
            const step = {
                ArrowRight: 1,
                ArrowLeft: -1,
                Home: -TABS.length,
                End: TABS.length
            } [event.key];
            if (!step) return;
            event.preventDefault();
            const index = Math.min(TABS.length - 1, Math.max(0, TABS.indexOf(tab) + step));
            showTab(TABS[index], true);
            el("tab-" + TABS[index]).focus();
        });
    }
    addEventListener("hashchange", () => showTab(location.hash.slice(1)));
}

/* ---------- filter state ---------- */

// a filter is just the string "facet|value", or "fav"
let filters = new Set();
let draftFilters = null;
let sortMode = "default";
let focusId = null;

const filterKey = (facet, value) => facet + "|" + value;
const toggleFilter = (set, key) => set.delete(key) || set.add(key);
const selectedValues = (set, facet) =>
    FACETS[facet].options.filter(option => set.has(filterKey(facet, option.value))).map(option => option.value);

/* ---------- url state ---------- */

function readUrl() {
    const params = new URLSearchParams(location.search);
    focusId = params.get("id");
    for (const [facet, {
            param,
            options
        }] of Object.entries(FACETS)) {
        for (const value of (params.get(param) || "").split(",")) {
            if (options.some(option => option.value === value)) filters.add(filterKey(facet, value));
        }
    }
    if (params.get("fav") === "1") filters.add("fav");
    const requestedSort = params.get("sort");
    if (requestedSort && [...sortSelect.options].some(option => option.value === requestedSort)) sortMode = requestedSort;
    sortSelect.value = sortMode;
}

function syncUrl() {
    const params = new URLSearchParams();
    if (focusId) params.set("id", focusId);
    for (const facet in FACETS) {
        const values = selectedValues(filters, facet);
        if (values.length) params.set(FACETS[facet].param, values.join(","));
    }
    if (filters.has("fav")) params.set("fav", "1");
    if (sortMode !== "default") params.set("sort", sortMode);
    const query = params.toString();
    const hash = currentTab === "promos" ? "" : "#" + currentTab;
    try {
        history.replaceState(null, "", location.pathname + (query ? "?" + query : "") + hash);
    } catch {}
}

/* ---------- confetti and clipboard ---------- */

const CONFETTI_COLORS = ["#F26A1B", "#E8A700", "#2E8B57", "#3B82F6", "#E11D48"];

function confetti(button) {
    if (reducedMotion) return;
    button.classList.add("burst");
    for (let i = 0; i < 18; i++) {
        const piece = document.createElement("i");
        const angle = Math.random() * Math.PI * 2;
        const distance = 40 + Math.random() * 60;
        piece.className = "confetti";
        piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        piece.style.setProperty("--dx", Math.cos(angle) * distance + "px");
        piece.style.setProperty("--dy", Math.sin(angle) * distance + 50 + "px");
        piece.addEventListener("animationend", () => piece.remove());
        button.appendChild(piece);
    }
}

async function copyText(text, fallbackElement) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        if (!fallbackElement) return false;
        const range = document.createRange();
        range.selectNodeContents(fallbackElement);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        try {
            return document.execCommand("copy");
        } catch {
            return false;
        }
    }
}

/* ---------- matching and ordering ---------- */

function matchesSearch(promo, term) {
    if (!term) return true;
    return promo.name.toLowerCase().includes(term) ||
        promo.codes.some(code => code.toLowerCase().includes(term)) ||
        RATING[ratingOf(promo)].words.includes(term) ||
        (promo.reward || "").toLowerCase().includes(term) ||
        promo.rules.some(rule => rule.t.toLowerCase().includes(term));
}

function passesFilters(promo, set) {
    if (!set.size) return true;
    if (set.has("fav") && !favorites.has(promo.id)) return false;
    for (const facet in FACETS) {
        const wanted = selectedValues(set, facet);
        const has = facet === "rating" ? [ratingOf(promo)] : (promo[facet] || []).map(value => String(value).replace(/\*$/, ""));
        if (wanted.length && !wanted.some(value => has.includes(value))) return false;
    }
    return true;
}

function orderedPromos() {
    const byIndex = (a, b) => a.index - b.index;
    const compare = {
        default: byIndex,
        rating: (a, b) => RATING_ORDER[ratingOf(a.promo)] - RATING_ORDER[ratingOf(b.promo)] || byIndex(a, b),
        name: (a, b) => a.promo.name.localeCompare(b.promo.name),
    } [sortMode];
    const favoritesFirst = (a, b) => favorites.has(b.promo.id) - favorites.has(a.promo.id);
    return PROMOS
        .map((promo, index) => ({
            promo,
            index
        }))
        .sort((a, b) => favoritesFirst(a, b) || compare(a, b))
        .map(entry => entry.promo);
}

/* ---------- promo card markup ---------- */

function factHtml(label, values) {
    const known = values && values.length;
    return `<div class="fact"><span>${label}</span><b${known ? "" : ' class="unk"'}>${known ? escapeHtml(values.join(", ")) : "Unknown"}</b></div>`;
}

function codesHtml(promo) {
    return promo.codes.map(code => `
      <div class="code">
        <code>${escapeHtml(code)}</code>
        <button type="button" data-code="${escapeHtml(code)}" aria-label="Copy code ${escapeHtml(code)}">Copy</button>
      </div>`).join("");
}

function screenshotsHtml(promo) {
    const shots = screenshotsOf(promo);
    if (!shots.length) return "";
    const figures = shots.map(shot => `
      <figure>
        <button type="button" class="shot" aria-label="Open screenshot of ${escapeHtml(promo.name)}">
          <img src="${shot.src}" loading="lazy" decoding="async" alt="Screenshot of ${escapeHtml(promo.name)} promo page">
        </button>
        ${shot.caption ? `<figcaption>${shot.caption}</figcaption>` : ""}
      </figure>`).join("");
    return `<div class="shots">${figures}</div>`;
}

function rulesHtml(promo) {
    const list = promo.rules.length ?
        `<ul class="rules">${promo.rules.map(rule => `<li${rule.warn ? ' class="warn"' : ""}>${rule.t}</li>`).join("")}</ul>` :
        "";
    const pending = promo.pending || !promo.rules.length ? `<p class="todo">Not finished yet - Coming soon!</p>` : "";
    return list + pending;
}

function cardHtml(promo) {
    const rating = ratingOf(promo);
    const name = escapeHtml(promo.name);
    const id = escapeHtml(promo.id);
    const detail = isFarmland(promo) ?
        `<button type="button" class="go">Open the Farmland tab</button>` :
        screenshotsHtml(promo) + rulesHtml(promo);

    return `
    <div class="head">
      <span class="star ${rating}" title="${RATING[rating].label}" aria-label="${RATING[rating].label}">${RATING[rating].emoji}</span>
      <button type="button" class="toggle" aria-expanded="false" aria-controls="b-${id}"><h2>${name}</h2></button>
      <button type="button" class="icon fav" aria-pressed="false">${ICON.star}</button>
      <button type="button" class="icon share" aria-label="Share link to ${name}" title="Share link">${isTouch ? ICON.share : ICON.link}</button>
      <button type="button" class="icon chevbtn" aria-label="Expand ${name}" tabindex="-1">${ICON.chevron}</button>
    </div>
    <div class="codes">${codesHtml(promo)}</div>
    <div class="facts">${factHtml("Type", promo.type)}${factHtml("Accepts", promo.accepts)}${factHtml("Payout", promo.payout)}${[promo.type, promo.accepts, promo.payout].some(values => (values || []).some(value => String(value).endsWith("*"))) ? `<p class="fact-note">* not always offered</p>` : ""}</div>
    <div class="body" id="b-${id}" hidden>
      ${promo.reward ? `<p class="reward">${promo.reward}</p>` : ""}
      ${detail}
      ${promo.terms || hasCalc(promo) ? `<div class="foot-row">${promo.terms ? `<button type="button" class="info">${ICON.rules}Rules</button>` : ""}${hasCalc(promo) ? `<button type="button" class="info calcbtn">${ICON.calc}Calculator</button>` : ""}</div>` : ""}
    </div>`;
}

/* ---------- promo cards ---------- */

const cards = new Map();
const emptyNotice = document.createElement("div");
emptyNotice.className = "empty";
emptyNotice.textContent = "No promos match.";
emptyNotice.hidden = true;

function setOpen(card, open, auto) {
    card.classList.toggle("open", open);
    card.querySelector(".toggle").setAttribute("aria-expanded", open);
    card.querySelector(".body").hidden = !open;
    if (auto) card.dataset.auto = "1";
    else delete card.dataset.auto;
}

function refreshFavoriteButton(card, promo) {
    const on = favorites.has(promo.id);
    const button = card.querySelector(".fav");
    button.classList.toggle("on", on);
    button.setAttribute("aria-pressed", on);
    button.setAttribute("aria-label", on ? `Remove ${promo.name} from favorites` : `Add ${promo.name} to favorites`);
}

function shareLink(promo) {
    const url = new URL(location.href);
    url.search = "?id=" + encodeURIComponent(promo.id);
    url.hash = "";
    return url.href;
}

function buildCard(promo) {
    const card = document.createElement("article");
    card.className = "card promo";
    card.dataset.id = promo.id;
    card.id = "p-" + promo.id;
    card.innerHTML = cardHtml(promo);
    refreshFavoriteButton(card, promo);
    return card;
}

async function onCardClick(event, card, promo) {
    const hit = selector => event.target.closest(selector);

    if (hit(".toggle") || hit(".chevbtn")) {
        setOpen(card, !card.classList.contains("open"));
        return;
    }

    if (hit(".code button")) {
        const button = hit(".code button");
        await copyText(button.dataset.code, button.previousElementSibling);
        // label first: setting textContent would wipe the confetti back out of the button
        button.textContent = "Copied";
        button.classList.add("done");
        confetti(button);
        setTimeout(() => {
            button.replaceChildren("Copy");
            button.classList.remove("done");
        }, 1500);
        return;
    }

    if (hit(".fav")) {
        if (favorites.has(promo.id)) {
            favorites.delete(promo.id);
        } else {
            favorites.add(promo.id);
            confetti(hit(".fav"));
        }
        store.set("favs", JSON.stringify([...favorites]));
        refreshFavoriteButton(card, promo);
        if (!favoriteHintShown && favorites.size) {
            favoriteHintShown = true;
            store.set("favhint", "1");
            toast("Favorites are saved on this device only");
        }
        render();
        return;
    }

    if (hit(".share")) {
        const button = hit(".share");
        const url = shareLink(promo);
        if (isTouch && navigator.share) {
            try {
                await navigator.share({
                    title: promo.name,
                    url
                });
                return;
            } catch {}
        }
        if (await copyText(url)) {
            toast("Link copied");
            confetti(button);
        } else {
            toast(url);
        }
        return;
    }

    if (hit(".calcbtn")) openCalc(promo);
    else if (hit(".info")) openTerms(promo);
    if (hit(".go")) {
        showTab("farmland", true);
        scrollTo(0, 0);
    }
}

function buildCards() {
    const byId = new Map(PROMOS.map(promo => [promo.id, promo]));
    for (const promo of PROMOS) cards.set(promo.id, buildCard(promo));
    promoList.appendChild(emptyNotice);
    delegate(promoList, ".promo", (card, event) => onCardClick(event, card, byId.get(card.dataset.id)));
}

/* ---------- rendering ---------- */

function render() {
    const term = searchInput.value.trim().toLowerCase();
    const visible = [];

    for (const promo of orderedPromos()) {
        const card = cards.get(promo.id);
        const shown = passesFilters(promo, filters) && matchesSearch(promo, term);
        card.hidden = !shown;
        if (shown) {
            visible.push(card);
            if (term && !card.classList.contains("open")) setOpen(card, true, true);
            else if (!term && card.dataset.auto) setOpen(card, false);
        }
    }

    // move only the cards that are out of place, then hand focus back to whatever moved under it
    const focused = document.activeElement;
    visible.forEach((card, index) => {
        if (promoList.children[index] !== card) promoList.insertBefore(card, promoList.children[index] || null);
    });
    promoList.appendChild(emptyNotice);
    if (focused && focused.isConnected && focused !== document.activeElement) focused.focus();

    emptyNotice.hidden = visible.length > 0;
    promoCount.textContent = visible.length === PROMOS.length ?
        `${visible.length} promos` :
        `${visible.length} of ${PROMOS.length} promos`;

    const count = filters.size;
    const badge = el("filter-count");
    badge.hidden = !count;
    badge.textContent = count;
    filterButton.classList.toggle("on", count > 0);

    renderActiveFilters();
    syncFacets(el("facets"), filters);
}

/* ---------- facet chips ---------- */

function facetsHtml() {
    const facet = (label, chips) => `<fieldset class="facet"><legend>${label}</legend><div class="chips">${chips}</div></fieldset>`;
    const chip = (key, label, extraClass = "") =>
        `<button type="button" class="chip${extraClass}" aria-pressed="false" data-key="${key}">${label}</button>`;

    let html = "";
    for (const [key, entry] of Object.entries(FACETS)) {
        const chips = entry.options.map(option => chip(escapeHtml(filterKey(key, option.value)), option.label)).join("");
        html += facet(entry.label, chips);
    }
    return html + facet("Favorites", chip("fav", ICON.star + "Favorites only", " fav"));
}

function syncFacets(container, set) {
    for (const chip of container.querySelectorAll(".chip")) {
        const on = set.has(chip.dataset.key);
        chip.classList.toggle("on", on);
        chip.setAttribute("aria-pressed", on);
    }
}

function mountFacets(container, onToggle) {
    container.hidden = false;
    container.innerHTML = facetsHtml();
    delegate(container, ".chip", chip => onToggle(chip.dataset.key));
}

function renderActiveFilters() {
    const container = el("active");
    const items = [];

    for (const [facet, {
            label,
            options
        }] of Object.entries(FACETS)) {
        for (const option of options) {
            if (filters.has(filterKey(facet, option.value))) {
                items.push({
                    key: filterKey(facet, option.value),
                    label: `${label}: ${option.label}`
                });
            }
        }
    }
    if (filters.has("fav")) items.push({
        key: "fav",
        label: "Favorites only"
    });

    container.hidden = !items.length;
    container.innerHTML = items.map(item =>
        `<span class="pill">${item.label}<button type="button" data-key="${item.key}" aria-label="Remove filter ${escapeHtml(item.label)}">✕</button></span>`
    ).join("") + (items.length ? `<button type="button" class="clear">Clear all</button>` : "");
}

/* ---------- sheets (filters, full rules) ---------- */

let lastFocused = null;

function openSheet(sheet) {
    lastFocused = document.activeElement;
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
    sheet.querySelector(".close").focus();
}

function closeSheet(sheet) {
    if (!sheet.classList.contains("open")) return;
    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true");
    document.body.classList.remove("locked");
    if (lastFocused && lastFocused.isConnected) lastFocused.focus();
    lastFocused = null;
}

function trapTab(sheet, event) {
    if (event.key !== "Tab" || !sheet.classList.contains("open")) return;
    const focusable = [...sheet.querySelectorAll("button, select, input, a[href]")].filter(node => node.offsetParent);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

function openFilters() {
    draftFilters = new Set(filters);
    paintFilterSheet();
    openSheet(filterSheet);
    filterButton.setAttribute("aria-expanded", "true");
}

function closeFilters() {
    closeSheet(filterSheet);
    filterButton.setAttribute("aria-expanded", "false");
}

function paintFilterSheet() {
    syncFacets(el("filter-body"), draftFilters);
    const term = searchInput.value.trim().toLowerCase();
    const count = PROMOS.filter(promo => passesFilters(promo, draftFilters) && matchesSearch(promo, term)).length;
    el("filter-apply").textContent = draftFilters.size ?
        `Show ${count} promo${count === 1 ? "" : "s"}` :
        "Show all promos";
}

function openTerms(promo) {
    termsSheet.querySelector("h3").textContent = `${promo.name} · ${promo.codes.join(" / ")}`;
    el("terms-date").textContent = promo.updated || "";
    const pre = termsSheet.querySelector("pre");
    pre.innerHTML = promo.terms.split(/(<table[\s\S]*?<\/table>)\n?/).map((part, i) => i % 2 ? part : escapeHtml(part)).join("");
    pre.scrollTop = 0;
    openSheet(termsSheet);
}

function openCalc(promo) {
    const calc = promo.calc;
    const keys = calc.fields.map(field => field.k);
    let formula;
    try {
        formula = new Function(...keys, `return (${calc.f});`);
    } catch {
        formula = () => "—";
    }
    el("calc-title").textContent = promo.name;
    const body = el("calc-body");
    body.innerHTML = `
      ${calc.note ? `<p class="calc-note">${calc.note}</p>` : ""}
      ${calc.formula ? `<p class="calc-formula">${calc.formula}</p>` : ""}
      <div class="calc-fields">${calc.fields.map(field => `
        <label>${escapeHtml(field.label)}<input type="number" inputmode="decimal" step="${escapeHtml(field.step || "any")}" data-k="${escapeHtml(field.k)}" value="${escapeHtml(field.value)}"></label>`).join("")}
      </div>
      <div class="calc-out">${calc.out ? `<span>${escapeHtml(calc.out)}</span>` : ""}<output></output></div>`;
    const inputs = [...body.querySelectorAll("input")];
    const output = body.querySelector("output");
    const update = () => {
        const values = inputs.map(input => parseFloat(input.value));
        let result;
        try {
            result = values.some(value => !isFinite(value)) ? "—" : formula(...values);
        } catch {
            result = "—";
        }
        output.textContent = result;
    };
    body.oninput = update;
    update();
    openSheet(calcSheet);
}

function setUpSheets() {
    const active = el("active");
    delegate(active, ".pill button", button => {
        toggleFilter(filters, button.dataset.key);
        render();
        syncUrl();
    });
    delegate(active, ".clear", () => {
        filters = new Set();
        render();
        syncUrl();
    });

    mountFacets(el("facets"), key => {
        toggleFilter(filters, key);
        render();
        syncUrl();
    });
    mountFacets(el("filter-body"), key => {
        toggleFilter(draftFilters, key);
        paintFilterSheet();
    });

    filterButton.addEventListener("click", openFilters);

    el("filter-reset").addEventListener("click", () => {
        draftFilters = new Set();
        paintFilterSheet();
    });

    el("filter-apply").addEventListener("click", () => {
        filters = draftFilters;
        closeFilters();
        render();
        syncUrl();
    });

    filterSheet.addEventListener("click", event => {
        if (event.target === filterSheet || event.target.closest(".close")) closeFilters();
    });

    termsSheet.addEventListener("click", event => {
        if (event.target === termsSheet || event.target.closest(".close")) closeSheet(termsSheet);
    });

    calcSheet.addEventListener("click", event => {
        if (event.target === calcSheet || event.target.closest(".close")) closeSheet(calcSheet);
    });

    sortSelect.addEventListener("change", () => {
        sortMode = sortSelect.value;
        render();
        syncUrl();
    });
}

/* ---------- lightbox ---------- */

function openLightbox(src, alt) {
    const image = lightbox.querySelector("img");
    image.src = src;
    image.alt = alt || "";
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
}

function setUpLightbox() {
    lightbox.addEventListener("click", closeLightbox);
    delegate(document.body, ".shot", shot => {
        const image = shot.querySelector("img");
        openLightbox(image.src, image.alt);
    });
}

/* ---------- keyboard and search ---------- */

function isTyping() {
    const node = document.activeElement;
    return !!node && (node.isContentEditable || /^(input|textarea|select)$/i.test(node.tagName));
}

function setUpKeyboard() {
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            if (lightbox.classList.contains("open")) closeLightbox();
            else if (termsSheet.classList.contains("open")) closeSheet(termsSheet);
            else if (calcSheet.classList.contains("open")) closeSheet(calcSheet);
            else closeFilters();
            return;
        }
        if (event.key === "Tab") {
            trapTab(filterSheet, event);
            trapTab(termsSheet, event);
            trapTab(calcSheet, event);
            return;
        }
        if (event.key === "/" && !isTyping()) {
            event.preventDefault();
            showTab("promos", true);
            searchInput.focus();
        }
    });
}

function setUpSearch() {
    let timer;
    searchInput.addEventListener("input", () => {
        if (el("promos").hidden) showTab("promos", true);
        clearTimeout(timer);
        timer = setTimeout(render, 80);
    });
}

/* ---------- sellers ---------- */

const SELLER_BADGE = {
    local: {
        emoji: "🚛",
        title: "Ships from inside your country/region or nearby, so orders tend to show up faster"
    },
    star: {
        emoji: "🌟",
        title: "Ranked among the top sellers in its main category over the past 30 days"
    },
    packGood: {
        emoji: "📦",
        title: "Orders from this seller have shown up well protected"
    },
    packBad: {
        emoji: "💥",
        title: "Orders from this seller have shown up damaged or badly packed"
    },
};
const BAR_CLASSES = ["s5", "s4", "s3", "s2", "s1"];

function sellerHtml(seller) {
    const number = value => value.toLocaleString("en-US");
    const badges = seller.badges.map(key =>
        `<span class="seller-badge" title="${SELLER_BADGE[key].title}" aria-label="${SELLER_BADGE[key].title}">${SELLER_BADGE[key].emoji}</span>`
    ).join("");
    const barSummary = seller.bars.map((percent, i) => `${5 - i}★ ${percent}%`).join(" · ");
    const barSegments = seller.bars.map((percent, i) =>
        percent ? `<span class="${BAR_CLASSES[i]}" style="flex:${percent}" title="${5 - i}★ ${percent}%"></span>` : ""
    ).join("");
    const legend = seller.bars.map((percent, i) =>
        `<span><i class="${BAR_CLASSES[i]}"></i>${5 - i}★ <b>${percent}%</b></span>`
    ).join("");

    return `
    <img class="seller-avatar" src="${seller.avatar}" alt="" loading="lazy" decoding="async">
    <div class="seller-main">
      <div class="seller-top">
        <a href="${seller.url}" target="_blank" rel="noopener">${escapeHtml(seller.name)}</a>
        <span class="seller-rating">${seller.rating.toFixed(1)} <b>★</b> <small>${number(seller.reviews)} reviews</small></span>
      </div>
      <div class="seller-badges">${badges}</div>
    </div>
    <div class="seller-ship">
      <span class="lbl lbl-m">Shipping:</span><span class="lbl lbl-d">Shipping minimum</span><b>${escapeHtml(seller.shipping)}</b>
    </div>
    <div class="seller-sold">
      <span class="lbl lbl-d">Sold</span><b>${escapeHtml(seller.sold)}</b><span class="sold-m"> sold <i>·</i> <b>${number(seller.reviews)}</b> reviews</span>
    </div>
    <div class="seller-ratings">
      <span class="lbl lbl-d">Ratings</span>
      <div class="seller-bars" role="img" aria-label="${barSummary}">${barSegments}</div>
      <div class="seller-legend">${legend}</div>
    </div>`;
}

function setUpSellers() {
    const list = el("seller-list");
    const count = el("seller-count");
    const sortBy = el("seller-sort");
    const activeChips = new Set();
    const soldAsNumber = text => parseFloat(text) * (/K/i.test(text) ? 1000 : 1);

    const rows = SELLERS.map((seller, index) => {
        const row = document.createElement("article");
        row.className = "seller card";
        row.innerHTML = sellerHtml(seller);
        return {
            seller,
            index,
            row
        };
    });

    const matchesChips = seller => [...activeChips].every(chip =>
        chip === "free" ? seller.shipping === "Free" : seller.badges.includes(chip));

    function renderSellers() {
        const compare = {
            default: (a, b) => a.index - b.index,
            rating: (a, b) => b.seller.rating - a.seller.rating || b.seller.reviews - a.seller.reviews,
            sold: (a, b) => soldAsNumber(b.seller.sold) - soldAsNumber(a.seller.sold),
            reviews: (a, b) => b.seller.reviews - a.seller.reviews,
        } [sortBy.value];

        let shown = 0;
        for (const entry of [...rows].sort(compare)) {
            const visible = matchesChips(entry.seller);
            entry.row.hidden = !visible;
            if (visible) shown++;
            list.appendChild(entry.row);
        }
        count.textContent = shown === SELLERS.length ? `${shown} sellers` : `${shown} of ${SELLERS.length} sellers`;
    }

    delegate(el("seller-chips"), ".chip", chip => {
        const key = chip.dataset.f;
        toggleFilter(activeChips, key);
        chip.classList.toggle("on", activeChips.has(key));
        chip.setAttribute("aria-pressed", activeChips.has(key));
        renderSellers();
    });

    sortBy.addEventListener("change", renderSellers);
    renderSellers();
}

/* ---------- timeskip calculator ---------- */

// offset: [standard name, daylight name if the zone keeps one]
const ZONES = {
    14: ["Line Islands Time (LINT)"],
    13: ["Tonga Time (TOT)", "New Zealand Daylight Time (NZDT)"],
    12: ["New Zealand Standard Time (NZST)"],
    11: ["Solomon Islands Time (SBT)", "Australian Eastern Daylight Time (AEDT)"],
    10: ["Australian Eastern Standard Time (AEST)"],
    9: ["Japan Standard Time (JST)"],
    8: ["Hong Kong Time (HKT)"],
    7: ["Indochina Time (ICT)"],
    6: ["Alma-Ata Time (ALMT)"],
    5: ["Pakistan Standard Time (PKT)"],
    4: ["Gulf Standard Time (GST)"],
    3: ["Moscow Standard Time (MSK)", "Eastern European Summer Time (EEST)"],
    2: ["Eastern European Time (EET)", "Central European Summer Time (CEST)"],
    1: ["Central European Time (CET)", "British Summer Time (BST)"],
    0: ["Greenwich Mean Time (GMT)", "Azores Summer Time (AZOST)"],
    "-1": ["Azores Standard Time (AZOT)"],
    "-2": ["Fernando de Noronha Time (FNT)"],
    "-3": ["Argentina Time (ART)", "Atlantic Daylight Time (ADT)"],
    "-4": ["Atlantic Standard Time (AST)", "Eastern Daylight Time (EDT)"],
    "-5": ["Eastern Standard Time (EST)", "Central Daylight Time (CDT)"],
    "-6": ["Central Standard Time (CST)", "Mountain Daylight Time (MDT)"],
    "-7": ["Mountain Standard Time (MST)", "Pacific Daylight Time (PDT)"],
    "-8": ["Pacific Standard Time (PST)", "Alaska Daylight Time (AKDT)"],
    "-9": ["Alaska Standard Time (AKST)"],
    "-10": ["Hawaii Standard Time (HST)"],
    "-11": ["Samoa Standard Time (SST)"],
    "-12": ["Anywhere on Earth (AoE)"],
};

function setUpTimeskip() {
    const button = el("tz-claim");
    const output = el("tz-out");
    if (!button) return;

    const HOUR = 3600e3;
    const DAY = 24 * HOUR;

    const month = new Date().getMonth();
    const northernSummer = month >= 3 && month <= 9;
    const zoneName = {};
    for (const [offset, names] of Object.entries(ZONES)) {
        const usesDaylight = northernSummer ? (offset <= 3 && offset >= -8) : offset >= 11;
        zoneName[offset] = (usesDaylight && names[1]) || names[0];
    }

    const gmtLabel = offset => "GMT" + (offset >= 0 ? "+" : "-") + String(Math.abs(offset)).padStart(2, "0") + ":00";
    const clock = ms => new Date(ms).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });
    const relative = ms => {
        const minutes = Math.ceil(ms / 60e3);
        return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    };
    const localZoneName = style => {
        try {
            return new Intl.DateTimeFormat([], {
                    timeZoneName: style
                }).formatToParts(new Date())
                .find(part => part.type === "timeZoneName").value;
        } catch {
            return "";
        }
    };
    const detectedZone = () => {
        const offsetMinutes = -new Date().getTimezoneOffset();
        const sign = offsetMinutes >= 0 ? "+" : "-";
        const absolute = Math.abs(offsetMinutes);
        const long = localZoneName("long");
        const short = localZoneName("short");
        return `GMT${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")} ${long}${short && short !== long ? ` (${short})` : ""}`;
    };

    let claimedAt = null;

    function run() {
        let html = `<div class="tz-zone"><span>Detected time zone:</span> ${detectedZone()}</div>`;
        if (!claimedAt) {
            output.innerHTML = html + "<span>Tap right after you claim.</span>";
            return;
        }

        const now = Date.now();
        const rollovers = [];
        for (let offset = 14; offset >= -12; offset--) {
            const nextMidnight = Math.floor((claimedAt + offset * HOUR) / DAY) * DAY + DAY - offset * HOUR;
            if (nextMidnight - claimedAt <= 30 * HOUR) rollovers.push({
                offset,
                at: nextMidnight
            });
        }
        rollovers.sort((a, b) => a.at - b.at);

        const ready = rollovers.filter(zone => zone.at <= now);
        const upcoming = rollovers.filter(zone => zone.at > now);

        html += '<div class="tz-list">';
        if (ready.length) {
            const zone = ready[ready.length - 1];
            html += `<div><b>Now</b> switch to <b>${gmtLabel(zone.offset)} ${zoneName[zone.offset]}</b></div>`;
        }
        for (const zone of upcoming.slice(0, 4)) {
            html += `<div>In <b>${relative(zone.at - now)}</b> (at ${clock(zone.at)}) switch to <b>${gmtLabel(zone.offset)} ${zoneName[zone.offset]}</b></div>`;
        }
        html += "</div>";
        html += `<div class="tz-since"><span>Last claim ${clock(claimedAt)} (${localZoneName("short")})</span></div>`;
        output.innerHTML = html;
    }

    button.addEventListener("click", () => {
        claimedAt = Date.now();
        run();
        confetti(button);
    });

    run();
}

/* ---------- boot ---------- */

setUpTheme();
setUpTabs();
setUpSheets();
setUpLightbox();
setUpKeyboard();
setUpSearch();

buildCards();
readUrl();

if (focusId && cards.has(focusId)) {
    filters = new Set();
    searchInput.value = "";
    showTab("promos");
    render();
    const card = cards.get(focusId);
    setOpen(card, true);
    requestAnimationFrame(() => card.scrollIntoView({
        block: "start"
    }));
} else {
    focusId = null;
    showTab(location.hash.slice(1));
    render();
}

setUpSellers();
setUpTimeskip();