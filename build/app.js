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
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const RATING_WORDS = {
    good: "good fire worth",
    meh: "meh average low zzz sleep",
    bad: "bad skull scam avoid",
};
const RATING_ORDER = {
    good: 0,
    meh: 1,
    bad: 2
};

// facet name -> the url param and the data- attribute that carry it
const PARAM = {
    rating: "r",
    payout: "p",
    accepts: "a",
    type: "t"
};

const promoList = el("list");
const promoCount = el("count");
const searchInput = el("q");
const sortSelect = el("sort");
const filterButton = el("filter-btn");
const filterSheet = el("filters");
const termsSheet = el("terms");
const calcSheet = el("calc");
const lightbox = el("lightbox");
const emptyNotice = promoList.querySelector(".empty");

/* ---------- toast ---------- */

let toastTimer;

function toast(message) {
    const box = el("toast");
    box.textContent = message;
    box.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("show"), 2200);
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
    const label = () => {
        const text = "Theme: " + THEME_NAMES[current()];
        button.setAttribute("aria-label", text);
        button.title = text;
    };

    // the two <meta theme-color> tags follow the OS by media query
    const bars = [...document.querySelectorAll('meta[name="theme-color"]')];
    const OS_BARS = [THEME_BARS.light, THEME_BARS.dark];
    const paintBar = () => {
        const theme = current();
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
        label();
        paintBar();
        toast("Theme: " + THEME_NAMES[next]);
    });

    label();
    paintBar();
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
for (const group of el("facets").querySelectorAll(".facet")) {
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
let copyTick = 0;

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
    const compare = {
        default: byIndex,
        rating: (a, b) => RATING_ORDER[a.node.dataset.r] - RATING_ORDER[b.node.dataset.r] || byIndex(a, b),
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

function shareLink(id) {
    const url = new URL(location.href);
    url.search = "?id=" + encodeURIComponent(id);
    url.hash = "";
    return url.href;
}

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

    if (hit(".code button")) {
        const button = hit(".code button");
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
            button.replaceChildren("Copy");
            button.setAttribute("aria-label", label);
            button.classList.remove("done");
        }, 1500);
        return;
    }

    if (hit(".fav")) {
        if (favorites.has(entry.id)) {
            favorites.delete(entry.id);
        } else {
            favorites.add(entry.id);
            confetti(hit(".fav"));
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

    if (hit(".share")) {
        const button = hit(".share");
        const url = shareLink(entry.id);
        if (isTouch && navigator.share) {
            try {
                await navigator.share({
                    title: entry.name,
                    url
                });
                return;
            } catch { }
        }
        if (await copyText(url)) {
            toast("Link copied");
            confetti(button);
        } else {
            toast(url);
        }
        return;
    }

    if (hit(".calcbtn")) openCalc(entry);
    else if (hit(".info")) openTerms(entry);
    if (hit(".go")) {
        showTab("farmland", true);
        scrollTo(0, 0);
    }
}

/* ---------- rendering ---------- */

function render() {
    const term = searchInput.value.trim().toLowerCase();
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
    promoList.appendChild(emptyNotice);
    if (focused && focused.isConnected) {
        const gone = focused.closest && focused.closest(".promo[hidden]");
        if (gone) searchInput.focus({ preventScroll: true });
        else if (focused !== document.activeElement) focused.focus({ preventScroll: true });
    }

    emptyNotice.hidden = visible.length > 0;
    promoCount.textContent = visible.length === entries.length ?
        `${visible.length} promos` :
        `${visible.length} of ${entries.length} promos`;

    // on a phone the button is icon-only, so its aria-label is the whole accessible
    // name and the count badge beside it would otherwise never be announced
    const count = filters.size;
    const badge = el("filter-count");
    badge.hidden = !count;
    badge.textContent = count;
    filterButton.classList.toggle("on", count > 0);
    filterButton.setAttribute("aria-label", count ? `Filters, ${count} active` : "Filters");

    renderActiveFilters();
    syncFacets(el("facets"), filters);
}

function syncFacets(container, set) {
    for (const chip of container.querySelectorAll(".chip")) {
        const on = set.has(chip.dataset.key);
        chip.classList.toggle("on", on);
        chip.setAttribute("aria-pressed", on);
    }
}

function renderActiveFilters() {
    const container = el("active");
    const keys = [...LABELS.keys()].filter(key => filters.has(key));

    container.hidden = !keys.length;
    container.innerHTML = keys.map(key =>
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
    syncFacets(el("filter-body"), draftFilters);
    const term = searchInput.value.trim().toLowerCase();
    const count = entries.filter(entry => passesFilters(entry, draftFilters) && matchesSearch(entry, term)).length;
    el("filter-apply").textContent = draftFilters.size ?
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
    const pre = termsSheet.querySelector("pre");
    termsSheet.querySelector("h3").textContent = `${entry.name} · ${codes.join(" / ")}`;
    termsSheet.dataset.for = entry.id;
    el("terms-date").textContent = "";
    pre.textContent = "Loading rules…";
    pre.scrollTop = 0;
    openSheet(termsSheet);

    let record;
    try {
        record = (await detailData()).t[entry.id];
    } catch { }
    if (termsSheet.dataset.for !== entry.id) return;
    if (!record) {
        pre.textContent = "Could not load the rules. Check your connection and try again.";
        return;
    }
    el("terms-date").textContent = record.u;
    pre.innerHTML = record.t.split(/(<table[\s\S]*?<\/table>)\n?/)
        .map((part, i) => i % 2 ? part : escapeHtml(part)).join("");
    pre.scrollTop = 0;
}

// calc.js is fetched the first time anyone opens a Calculator, then cached
async function openCalc(entry) {
    const body = el("calc-body");
    el("calc-title").textContent = entry.name;
    calcSheet.dataset.for = entry.id;
    body.innerHTML = `<p class="calc-note">Loading…</p>`;
    openSheet(calcSheet);

    try {
        const [module, data] = await Promise.all([import("./calc.js?v=__CALC__"), detailData()]);
        if (calcSheet.dataset.for !== entry.id) return;
        const calc = data.c[entry.id];
        if (!calc) throw Error("no calculator for " + entry.id);
        module.render(body, calc, entry.id);
    } catch {
        if (calcSheet.dataset.for === entry.id) {
            body.innerHTML = `<p class="calc-note">Could not load the calculator. Check your connection and try again.</p>`;
        }
    }
}

/* ---------- wiring ---------- */

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

    delegate(el("facets"), ".chip", chip => {
        toggleFilter(filters, chip.dataset.key);
        render();
        syncUrl();
    });
    delegate(el("filter-body"), ".chip", chip => {
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

    el("filter-apply").addEventListener("click", () => {
        filters = draftFilters;
        filterSheet.close();
        render();
        syncUrl();
    });

    for (const sheet of [filterSheet, termsSheet, calcSheet]) {
        sheet.addEventListener("click", event => {
            if (event.target === sheet || event.target.closest(".close")) sheet.close();
        });
    }

    for (const sheet of [filterSheet, termsSheet, calcSheet, lightbox]) {
        sheet.addEventListener("close", () => {
            if (!document.querySelector("dialog[open]")) document.body.classList.remove("locked");
        });
    }

    filterSheet.addEventListener("close", () => filterButton.setAttribute("aria-expanded", "false"));

    sortSelect.addEventListener("change", () => {
        sortMode = sortSelect.value;
        render();
        syncUrl();
    });
}

function setUpLightbox() {
    const image = lightbox.querySelector("img");
    lightbox.addEventListener("click", () => lightbox.close());
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

const ZONES = ("Line Islands Time (LINT)|Tonga Time (TOT);New Zealand Daylight Time (NZDT)|New Zealand Standard Time (NZST)|" +
    "Solomon Islands Time (SBT);Australian Eastern Daylight Time (AEDT)|Australian Eastern Standard Time (AEST)|" +
    "Japan Standard Time (JST)|Hong Kong Time (HKT)|Indochina Time (ICT)|Alma-Ata Time (ALMT)|Pakistan Standard Time (PKT)|" +
    "Gulf Standard Time (GST)|Moscow Standard Time (MSK);Eastern European Summer Time (EEST)|" +
    "Eastern European Time (EET);Central European Summer Time (CEST)|Central European Time (CET);British Summer Time (BST)|" +
    "Greenwich Mean Time (GMT);Azores Summer Time (AZOST)|Azores Standard Time (AZOT)|Fernando de Noronha Time (FNT)|" +
    "Argentina Time (ART);Atlantic Daylight Time (ADT)|Atlantic Standard Time (AST);Eastern Daylight Time (EDT)|" +
    "Eastern Standard Time (EST);Central Daylight Time (CDT)|Central Standard Time (CST);Mountain Daylight Time (MDT)|" +
    "Mountain Standard Time (MST);Pacific Daylight Time (PDT)|Pacific Standard Time (PST);Alaska Daylight Time (AKDT)|" +
    "Alaska Standard Time (AKST)|Hawaii Standard Time (HST)|Samoa Standard Time (SST)|Anywhere on Earth (AoE)")
    .split("|").map(names => names.split(";"));

function setUpTimeskip() {
    const button = el("tz-claim");
    const output = el("tz-out");
    if (!button) return;

    const HOUR = 3600e3;
    const DAY = 24 * HOUR;

    const month = new Date().getMonth();
    const northernSummer = month >= 3 && month <= 9;
    const zoneName = offset => {
        const names = ZONES[14 - offset];
        const usesDaylight = northernSummer ? (offset <= 3 && offset >= -8) : offset >= 11;
        return (usesDaylight && names[1]) || names[0];
    };

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
        if (ready.length) {
            const zone = ready[ready.length - 1];
            html += `<div><b>Now</b> switch to <b>${gmtLabel(zone.offset)} ${zoneName(zone.offset)}</b></div>`;
        }
        for (const zone of upcoming.slice(0, 4)) {
            html += `<div>In <b>${relative(zone.at - now)}</b> (at ${clock(zone.at)}) switch to <b>${gmtLabel(zone.offset)} ${zoneName(zone.offset)}</b></div>`;
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
setUpSheets();
setUpLightbox();
setUpKeyboard();
setUpSearch();

delegate(promoList, ".promo", (card, event) => onCardClick(event, byId.get(card.dataset.id)));
for (const entry of entries) refreshFavoriteButton(entry);
readUrl();

if (focusId && byId.has(focusId)) {
    filters = new Set();
    searchInput.value = "";
    showTab("promos");
    render();
    const card = byId.get(focusId).node;
    setOpen(card, true);
    requestAnimationFrame(() => card.scrollIntoView({
        block: "start"
    }));
    focusId = null;
    syncUrl();
} else {
    focusId = null;
    showTab(location.hash.slice(1));
    render();
}

setUpSellers();
setUpTimeskip();
