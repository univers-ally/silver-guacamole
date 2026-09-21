"use strict";

const el = id => document.getElementById(id);

function delegate(root, selector, handler) {
    root.addEventListener("click", event => {
        const hit = event.target.closest(selector);
        if (hit && root.contains(hit)) handler(hit, event);
    });
}

const escapeHtml = text => String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const RATING_WORDS = {
    good: "good fire worth",
    meh: "meh average low zzz sleep",
    bad: "bad skull scam avoid",
};
const RATING_RANK = Object.keys(RATING_WORDS);

// facet name -> the url param and the data- attribute that carry it.
// FACETS in build.js has to agree
const PARAM = {
    rating: "r",
    payout: "p",
    accepts: "a",
    type: "t"
};

const promoList = el("list");
const promoCount = el("count");
const promoEmpty = promoList.querySelector(".empty");
const searchInput = el("q");
const sortSelect = el("sort");
const facetChips = el("facets");
const activePills = el("active");
const filterButton = el("filter-btn");
const filterBadge = el("filter-count");
const filterSheet = el("filters");
const filterBody = el("filter-body");
const filterApply = el("filter-apply");
const termsSheet = el("terms");
const termsTitle = el("terms-title");
const termsDate = el("terms-date");
const termsText = termsSheet.querySelector("pre");
const calcSheet = el("calc");
const calcTitle = el("calc-title");
const calcBody = el("calc-body");
const lightbox = el("lightbox");
const toastBox = el("toast");

const searchTerm = () => searchInput.value.trim().toLowerCase();

/* ---------- toast ---------- */

let toastTimer;

function toast(message) {
    toastBox.textContent = message;
    toastBox.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastBox.classList.remove("show"), 2200);
}

/* ---------- storage ---------- */

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
        } catch { }
    },
    drop: key => {
        try {
            localStorage.removeItem(key);
        } catch { }
    },
};

/* ---------- theme ---------- */

const THEMES = ["auto", "light", "dark", "oled"];
const THEME_NAMES = {
    auto: "Auto",
    light: "Light",
    dark: "Dark",
    oled: "Ultra Dark"
};

// the browser chrome colour per theme, matching --paper in main.css
const THEME_BARS = {
    light: "#FAFAF8",
    dark: "#131313",
    oled: "#000000"
};

function setUpTheme() {
    const button = el("theme");
    const root = document.documentElement;
    const current = () => THEMES.includes(root.dataset.theme) ? root.dataset.theme : "auto";

    // the two <meta theme-color> tags follow the OS by media query until a
    // theme is picked, then both take that theme's colour
    const bars = [...document.querySelectorAll('meta[name="theme-color"]')];
    const OS_BARS = [THEME_BARS.light, THEME_BARS.dark];
    const paint = () => {
        const theme = current();
        const text = "Theme: " + THEME_NAMES[theme];
        button.setAttribute("aria-label", text);
        button.title = text;
        bars.forEach((meta, i) => meta.content = theme === "auto" ? OS_BARS[i] : THEME_BARS[theme]);
    };

    button.addEventListener("click", () => {
        const next = THEMES[(THEMES.indexOf(current()) + 1) % THEMES.length];
        if (next === "auto") {
            delete root.dataset.theme;
            store.drop("theme");
        } else {
            root.dataset.theme = next;
            store.set("theme", next);
        }
        paint();
        toast("Theme: " + THEME_NAMES[next]);
    });

    paint();
}

/* ---------- favorites ---------- */

let favorites = new Set();
try {
    favorites = new Set(JSON.parse(store.get("favs") || "[]"));
} catch { }
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
            }[event.key];
            if (!step) return;
            event.preventDefault();
            const index = Math.min(TABS.length - 1, Math.max(0, TABS.indexOf(tab) + step));
            showTab(TABS[index], true);
            el("tab-" + TABS[index]).focus();
        });
    }
    addEventListener("hashchange", () => showTab(location.hash.slice(1)));
}

/* ---------- promo cards ---------- */

const entries = [...promoList.querySelectorAll(".promo")].map((node, index) => {
    const name = node.querySelector(".toggle").textContent;
    const text = [name, node.dataset.s || ""]
        .concat([...node.querySelectorAll(".code code, .reward, .rules li")].map(part => part.textContent))
        .join(" ")
        .toLowerCase();
    return {
        node,
        index,
        name,
        text,
        id: node.dataset.id
    };
});
const byId = new Map(entries.map(entry => [entry.id, entry]));

/* ---------- filter state ---------- */

// a filter is just the string "facet|value", or "fav"
let filters = new Set();
let draftFilters = null;
let sortMode = "default";
let focusId = null;

const filterKey = (facet, value) => facet + "|" + value;
const toggleFilter = (set, key) => set.delete(key) || set.add(key);
const selectedValues = (set, facet) =>
    [...set].filter(key => key.startsWith(facet + "|")).map(key => key.slice(facet.length + 1));

// chip labels live in the markup, so the pills can read them back out
const LABELS = new Map();
for (const group of facetChips.querySelectorAll(".facet")) {
    const legend = group.querySelector("legend").textContent;
    for (const chip of group.querySelectorAll(".chip")) {
        const key = chip.dataset.key;
        LABELS.set(key, key === "fav" ? "Favorites only" : `${legend}: ${chip.textContent.trim()}`);
    }
}

/* ---------- url state ---------- */

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
    const requestedSort = params.get("sort");
    if (requestedSort && [...sortSelect.options].some(option => option.value === requestedSort)) sortMode = requestedSort;
    sortSelect.value = sortMode;
}

function syncUrl() {
    const params = new URLSearchParams();
    if (focusId) params.set("id", focusId);
    for (const facet in PARAM) {
        const values = selectedValues(filters, facet);
        if (values.length) params.set(PARAM[facet], values.join(","));
    }
    if (filters.has("fav")) params.set("fav", "1");
    if (sortMode !== "default") params.set("sort", sortMode);
    const query = params.toString();
    const hash = currentTab === "promos" ? "" : "#" + currentTab;
    try {
        history.replaceState(null, "", location.pathname + (query ? "?" + query : "") + hash);
    } catch { }
}

/* ---------- confetti and clipboard ---------- */

const CONFETTI_COLORS = ["#F26A1B", "#E8A700", "#2E8B57", "#3B82F6", "#E11D48"];

function confetti(button) {
    if (reducedMotion.matches) return;
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

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

/* ---------- matching and ordering ---------- */

function matchesSearch(entry, term) {
    if (!term) return true;
    return entry.text.includes(term) || RATING_WORDS[entry.node.dataset.r].includes(term);
}

function passesFilters(entry, set) {
    if (!set.size) return true;
    if (set.has("fav") && !favorites.has(entry.id)) return false;
    for (const facet in PARAM) {
        const wanted = selectedValues(set, facet);
        if (!wanted.length) continue;
        const has = (entry.node.dataset[PARAM[facet]] || "").split(",");
        if (!wanted.some(value => has.includes(value))) return false;
    }
    return true;
}

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

// auto marks a card the search opened rather than the reader, so render() knows
// which ones to close again once the search box is cleared
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
    button.setAttribute("aria-label", on ? `Remove ${entry.name} from favorites` : `Add ${entry.name} to favorites`);
}

let copyTick = 0;

async function onCardClick(event, entry) {
    const card = entry.node;
    const hit = selector => event.target.closest(selector);

    if (hit(".toggle") || hit(".chevbtn")) {
        const open = !card.classList.contains("open");
        setOpen(card, open);
        if (open) delete card.dataset.shut;
        else card.dataset.shut = "1";
        return;
    }

    const button = hit(".code button");
    if (button) {
        const label = button.dataset.label ||= button.getAttribute("aria-label");
        if (!await copyText(button.dataset.code)) {
            toast("Couldn't copy. Select the code and copy it by hand");
            return;
        }
        toast("Code copied");
        // label first: setting textContent would wipe the confetti back out of the button
        button.textContent = "Copied";
        button.setAttribute("aria-label", "Copied");
        button.classList.add("done");
        confetti(button);
        const tap = button.dataset.tap = String(++copyTick);
        setTimeout(() => {
            if (button.dataset.tap !== tap) return;
            button.textContent = "Copy";
            button.setAttribute("aria-label", label);
            button.classList.remove("done");
        }, 1500);
        return;
    }

    const fav = hit(".fav");
    if (fav) {
        if (favorites.has(entry.id)) {
            favorites.delete(entry.id);
        } else {
            favorites.add(entry.id);
            confetti(fav);
        }
        store.set("favs", JSON.stringify([...favorites]));
        refreshFavoriteButton(entry);
        if (!favoriteHintShown && favorites.size) {
            favoriteHintShown = true;
            store.set("favhint", "1");
            toast("Favorites are saved on this device only");
        }
        render();
        return;
    }

    // the head's calculator icon and the foot row's labelled buttons all carry data-open
    const opener = hit("[data-open]");
    if (opener) {
        if (opener.dataset.open === "calc") openCalc(entry);
        else openTerms(entry);
        return;
    }

    const go = hit(".go");
    if (go) {
        showTab(go.dataset.tab, true);
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
        if (shown) {
            visible.push(card);
            if (!term) delete card.dataset.shut;
            if (term && !card.dataset.shut && !card.classList.contains("open")) setOpen(card, true, true);
            else if (!term && card.dataset.auto) setOpen(card, false);
        }
    }

    visible.forEach((card, index) => {
        if (promoList.children[index] !== card) promoList.insertBefore(card, promoList.children[index] || null);
    });
    promoList.appendChild(promoEmpty);
    if (focused && focused.isConnected) {
        if (focused.closest(".promo[hidden]")) searchInput.focus({ preventScroll: true });
        else if (focused !== document.activeElement) focused.focus({ preventScroll: true });
    }

    promoEmpty.hidden = visible.length > 0;
    promoCount.textContent = visible.length === entries.length ?
        `${visible.length} promos` :
        `${visible.length} of ${entries.length} promos`;

    // on a phone the button is icon-only, so its aria-label is the whole accessible
    // name and the count badge beside it would otherwise never be announced
    const count = filters.size;
    filterBadge.hidden = !count;
    filterBadge.textContent = count;
    filterButton.classList.toggle("on", count > 0);
    filterButton.setAttribute("aria-label", count ? `Filters, ${count} active` : "Filters");

    renderActiveFilters();
    syncFacets(facetChips, filters);
}

function syncFacets(container, set) {
    for (const chip of container.querySelectorAll(".chip")) {
        const on = set.has(chip.dataset.key);
        chip.classList.toggle("on", on);
        chip.setAttribute("aria-pressed", on);
    }
}

function renderActiveFilters() {
    const keys = [...LABELS.keys()].filter(key => filters.has(key));

    activePills.hidden = !keys.length;
    activePills.innerHTML = keys.map(key =>
        `<span class="pill">${LABELS.get(key)}<button type="button" data-key="${escapeHtml(key)}" aria-label="Remove filter ${escapeHtml(LABELS.get(key))}">✕</button></span>`
    ).join("") + (keys.length ? `<button type="button" class="clear">Clear all</button>` : "");
}

/* ---------- sheets ---------- */

function openSheet(sheet) {
    if (sheet.open) return;
    sheet.showModal();
    document.body.classList.add("locked");
    const close = sheet.querySelector(".close");
    if (close) close.focus();
}

function paintFilterSheet() {
    syncFacets(filterBody, draftFilters);
    const term = searchTerm();
    const count = entries.filter(entry => passesFilters(entry, draftFilters) && matchesSearch(entry, term)).length;
    filterApply.textContent = draftFilters.size ?
        `Show ${count} promo${count === 1 ? "" : "s"}` :
        "Show all promos";
}

/* ---------- rules and calculator (fetched on first use) ---------- */

let detailRequest;
const detailData = () => (detailRequest ||= fetch("data.json?v=__DATA__")
    .then(response => response.ok ? response.json() : Promise.reject(Error(response.status)))
    .catch(error => {
        detailRequest = null; // so the next tap can retry instead of failing forever
        throw error;
    }));

async function openTerms(entry) {
    const codes = [...entry.node.querySelectorAll(".code code")].map(node => node.textContent);
    termsTitle.textContent = `${entry.name} · ${codes.join(" / ")}`;
    termsSheet.dataset.for = entry.id;
    termsDate.textContent = "";
    termsText.textContent = "Loading rules…";
    termsText.scrollTop = 0;
    openSheet(termsSheet);

    let record;
    try {
        record = (await detailData()).t[entry.id];
    } catch { }
    if (termsSheet.dataset.for !== entry.id) return;
    if (!record) {
        termsText.textContent = "Could not load the rules. Check your connection and try again.";
        return;
    }
    termsDate.textContent = record.u;
    // terms are plain text, except for the odd <table> a promo carries as markup
    termsText.innerHTML = record.t.split(/(<table[\s\S]*?<\/table>)\n?/)
        .map((part, i) => i % 2 ? part : escapeHtml(part)).join("");
    termsText.scrollTop = 0;
}

// calc.js is fetched the first time anyone opens a Calculator, then cached
async function openCalc(entry) {
    calcTitle.textContent = entry.name;
    calcSheet.dataset.for = entry.id;
    calcBody.innerHTML = `<p class="calc-note">Loading…</p>`;
    openSheet(calcSheet);

    try {
        const [module, data] = await Promise.all([import("./calc.js?v=__CALC__"), detailData()]);
        if (calcSheet.dataset.for !== entry.id) return;
        const calc = data.c[entry.id];
        if (!calc) throw Error("no calculator for " + entry.id);
        module.render(calcBody, calc, entry.id);
    } catch {
        if (calcSheet.dataset.for === entry.id) {
            calcBody.innerHTML = `<p class="calc-note">Could not load the calculator. Check your connection and try again.</p>`;
        }
    }
}

/* ---------- wiring ---------- */

function setUpFilters() {
    const apply = () => {
        render();
        syncUrl();
    };
    delegate(activePills, ".pill button", button => {
        toggleFilter(filters, button.dataset.key);
        apply();
    });
    delegate(activePills, ".clear", () => {
        filters = new Set();
        apply();
    });
    delegate(facetChips, ".chip", chip => {
        toggleFilter(filters, chip.dataset.key);
        apply();
    });
    sortSelect.addEventListener("change", () => {
        sortMode = sortSelect.value;
        apply();
    });

    delegate(filterBody, ".chip", chip => {
        toggleFilter(draftFilters, chip.dataset.key);
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

function setUpDialogs() {
    for (const sheet of [filterSheet, termsSheet, calcSheet]) {
        sheet.addEventListener("click", event => {
            if (event.target === sheet || event.target.closest(".close")) sheet.close();
        });
    }
    lightbox.addEventListener("click", () => lightbox.close());

    for (const dialog of [filterSheet, termsSheet, calcSheet, lightbox]) {
        dialog.addEventListener("close", () => {
            if (!document.querySelector("dialog[open]")) document.body.classList.remove("locked");
        });
    }
}

function setUpLightbox() {
    const image = lightbox.querySelector("img");
    delegate(document.body, ".shot", shot => {
        const source = shot.querySelector("img");
        const figure = shot.closest("figure");
        const figcaption = figure && figure.querySelector("figcaption");
        const caption = figcaption
            ? figcaption.textContent.trim()
            : (shot.getAttribute("aria-label") || "").replace(/^Open screenshot(?::| of)\s*/, "");
        image.src = source.src;
        image.alt = source.alt || caption;
        lightbox.setAttribute("aria-label", caption || "Screenshot");
        openSheet(lightbox);
    });
}

function isTyping() {
    const node = document.activeElement;
    return !!node && (node.isContentEditable || /^(input|textarea|select)$/i.test(node.tagName));
}

function setUpKeyboard() {
    document.addEventListener("keydown", event => {
        if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey
            && !isTyping() && !document.querySelector("dialog[open]")) {
            event.preventDefault();
            showTab("promos", true);
            searchInput.focus();
        }
    });
}

function setUpSearch() {
    let timer;
    searchInput.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(render, 80);
    });
}

/* ---------- sellers ---------- */

function setUpSellers() {
    const list = el("seller-list");
    const count = el("seller-count");
    const sortBy = el("seller-sort");
    const empty = list.querySelector(".empty");
    const activeChips = new Set();
    const rows = [...list.querySelectorAll(".seller")].map((node, index) => ({
        node,
        index
    }));
    const value = (row, key) => parseFloat(row.node.dataset[key]);
    const matchesChips = row => [...activeChips].every(chip =>
        chip === "free" ? row.node.dataset.free === "1" : row.node.dataset.badges.split(" ").includes(chip));

    function renderSellers() {
        const compare = {
            default: (a, b) => a.index - b.index,
            rating: (a, b) => value(b, "rating") - value(a, "rating") || value(b, "reviews") - value(a, "reviews"),
            sold: (a, b) => value(b, "sold") - value(a, "sold"),
            reviews: (a, b) => value(b, "reviews") - value(a, "reviews"),
        }[sortBy.value];

        let shown = 0;
        for (const row of [...rows].sort(compare)) {
            const visible = matchesChips(row);
            row.node.hidden = !visible;
            if (visible) shown++;
            list.appendChild(row.node);
        }
        list.appendChild(empty);
        empty.hidden = shown > 0;
        count.textContent = shown === rows.length ? `${shown} sellers` : `${shown} of ${rows.length} sellers`;
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

const ZONES = [
    ["Line Islands Time (LINT)"],                                                  // +14
    ["Tonga Time (TOT)", "New Zealand Daylight Time (NZDT)"],                      // +13
    ["New Zealand Standard Time (NZST)"],                                          // +12
    ["Solomon Islands Time (SBT)", "Australian Eastern Daylight Time (AEDT)"],     // +11
    ["Australian Eastern Standard Time (AEST)"],                                   // +10
    ["Japan Standard Time (JST)"],                                                 // +9
    ["Hong Kong Time (HKT)"],                                                      // +8
    ["Indochina Time (ICT)"],                                                      // +7
    ["Alma-Ata Time (ALMT)"],                                                      // +6
    ["Pakistan Standard Time (PKT)"],                                              // +5
    ["Gulf Standard Time (GST)"],                                                  // +4
    ["Moscow Standard Time (MSK)", "Eastern European Summer Time (EEST)"],         // +3
    ["Eastern European Time (EET)", "Central European Summer Time (CEST)"],        // +2
    ["Central European Time (CET)", "British Summer Time (BST)"],                  // +1
    ["Greenwich Mean Time (GMT)", "Azores Summer Time (AZOST)"],                   //  0
    ["Azores Standard Time (AZOT)"],                                               // -1
    ["Fernando de Noronha Time (FNT)"],                                            // -2
    ["Argentina Time (ART)", "Atlantic Daylight Time (ADT)"],                      // -3
    ["Atlantic Standard Time (AST)", "Eastern Daylight Time (EDT)"],               // -4
    ["Eastern Standard Time (EST)", "Central Daylight Time (CDT)"],                // -5
    ["Central Standard Time (CST)", "Mountain Daylight Time (MDT)"],               // -6
    ["Mountain Standard Time (MST)", "Pacific Daylight Time (PDT)"],               // -7
    ["Pacific Standard Time (PST)", "Alaska Daylight Time (AKDT)"],                // -8
    ["Alaska Standard Time (AKST)"],                                               // -9
    ["Hawaii Standard Time (HST)"],                                                // -10
    ["Samoa Standard Time (SST)"],                                                 // -11
    ["Anywhere on Earth (AoE)"],                                                   // -12
];
const gmtLabel = minutes => {
    const absolute = Math.abs(minutes);
    const pad = n => String(n).padStart(2, "0");
    return `GMT${minutes < 0 ? "-" : "+"}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
};

function setUpTimeskip() {
    const button = el("tz-claim");
    const output = el("tz-out");

    const HOUR = 3600e3;
    const DAY = 24 * HOUR;

    const month = new Date().getMonth();
    const northernSummer = month >= 3 && month <= 9;
    const zoneName = offset => {
        const [standard, daylight] = ZONES[14 - offset];
        const usesDaylight = northernSummer ? (offset <= 3 && offset >= -8) : offset >= 11;
        return (usesDaylight && daylight) || standard;
    };

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
        const long = localZoneName("long");
        const short = localZoneName("short");
        return `${gmtLabel(-new Date().getTimezoneOffset())} ${long}${short && short !== long ? ` (${short})` : ""}`;
    };

    let claimedAt = null;
    let tick = null;

    function run() {
        let html = `<div class="tz-zone"><span>Detected time zone:</span> ${detectedZone()}</div>`;
        if (!claimedAt) {
            output.innerHTML = html + "<span>Tap right after you claim.</span>";
            return;
        }

        const now = Date.now();
        const rollovers = [];
        // shift the claim into each zone's local time, round down to its midnight, add a day,
        // then shift back to UTC: that is when a daily promo rolls over in that zone. 30h of
        // them covers every zone once, since the offsets span 26 hours
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
        const zoneLabel = zone => `${gmtLabel(zone.offset * 60)} ${zoneName(zone.offset)}`;
        if (ready.length) {
            html += `<div><b>Now</b> switch to <b>${zoneLabel(ready[ready.length - 1])}</b></div>`;
        }
        for (const zone of upcoming.slice(0, 4)) {
            html += `<div>In <b>${relative(zone.at - now)}</b> (at ${clock(zone.at)}) switch to <b>${zoneLabel(zone)}</b></div>`;
        }
        html += "</div>";
        html += `<div class="tz-since"><span>Last claim ${clock(claimedAt)} (${localZoneName("short")})</span></div>`;
        output.innerHTML = html;
    }

    button.addEventListener("click", () => {
        claimedAt = Date.now();
        run();
        confetti(button);
        tick ||= setInterval(run, 60e3);
    });

    run();
}

/* ---------- boot ---------- */

setUpTheme();
setUpTabs();
setUpFilters();
setUpDialogs();
setUpLightbox();
setUpKeyboard();
setUpSearch();

delegate(promoList, ".promo", (card, event) => onCardClick(event, byId.get(card.dataset.id)));
for (const entry of entries) refreshFavoriteButton(entry);
readUrl();

const shared = byId.get(focusId);
focusId = null;
if (shared) {
    filters = new Set();
    searchInput.value = "";
    showTab("promos");
    render();
    setOpen(shared.node, true);
    requestAnimationFrame(() => shared.node.scrollIntoView({
        block: "start"
    }));
    syncUrl();
} else {
    showTab(location.hash.slice(1));
    render();
}

setUpSellers();
setUpTimeskip();
