import { RATING } from "./vocab.js";

export { RATING, FACETS, TABS, TAB_LABEL } from "./vocab.js";

export const SITE = {
  name: "How to Temu",
  tagline: "(for cards)",
  description: "Temu guide for dummies, tcg collectors, and folks in Temu jail.",
};

/* ---------- promos ---------- */

export const REWARDS = {
  Water: { note: "Grams of water for the crops" },
  Credit: { note: "Temu credit, spends anywhere" },
  Coupon: { note: "A Temu coupon, spends anywhere its terms allow" },
  "Farmland coupon": { note: "A coupon that only spends on the Farmland page" },
  Cosmetic: { note: "Pays nothing. It only changes how the page looks" },
};

export const ratingOf = promo => (RATING[promo.rating] ? promo.rating : "meh");
export const hasCalc = promo => !!promo.calc;
export const appsOf = promo => promo.apps || [];
export const subsOf = app => app.sub || [];

// "Cash*" -> "Cash": the star means "not always offered"; it's shown, not filtered on
export const clean = values => (values || []).map(value => String(value).replace(/\*$/, ""));

export const longDate = date =>
  new Date(date + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

export const updatedText = promo =>
  promo.date ? "Rules last updated " + longDate(promo.date) : "";

const summaryNote = item =>
  `Basic summary of rules${item.date ? `, last updated ${longDate(item.date)}` : ""}. Check the full rules in the app.`;

const wordsOf = item =>
  [
    item.name || "",
    item.blurb || "",
    ...(item.rules || []).map(rule => rule.t),
    ...(item.images || []).map(shot => shot.caption || ""),
    ...appsOf(item).map(wordsOf),
    ...subsOf(item).map(wordsOf),
  ].join(" ");

export const hiddenWords = promo =>
  wordsOf(promo)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export function detailData(promos) {
  const detail = { t: {}, c: {} };
  for (const promo of promos) {
    if (promo.summary) detail.t[promo.id] = { t: promo.summary, u: summaryNote(promo) };
    if (hasCalc(promo)) detail.c[promo.id] = promo.calc;
    for (const app of appsOf(promo).flatMap(parent => [parent, ...subsOf(parent)])) {
      if (app.summary)
        detail.t[app.id] = { t: app.summary, u: summaryNote(app.date ? app : promo) };
    }
  }
  return detail;
}

/* ---------- sellers ---------- */

export const SELLER_BADGE = {
  local: {
    emoji: "🚛",
    label: "Local warehouse",
    title: "Ships from inside your country/region or nearby, so orders tend to show up faster",
    legend:
      "means the seller ships from inside your country/region or somewhere nearby, so orders tend to show up faster.",
  },
  star: {
    emoji: "🌟",
    chip: "Star store",
    label: "Star store",
    title:
      "Ranked among the top 5% of sellers in its main category over the past 30 days, on sales and review ratings combined",
    legend:
      "means the store ranked in the top 5% of its main product category over the past 30 days, counting sales and review ratings together.",
  },
  fast: {
    emoji: "🚀",
    chip: "Fast delivery",
    label: "Fast delivery",
    title:
      "Among the top 10% in its category over the past 30 days for how quickly orders ship out and arrive",
    legend:
      "means the store ranked in the top 10% of its category over the past 30 days for how quickly orders ship out and arrive.",
  },
  veteran: {
    emoji: "🗓️",
    chip: "Established",
    label: "Established store",
    title: "Has been selling on Temu for more than a year",
    legend: "means the store has been selling on Temu for more than a year.",
  },
  handmade: {
    emoji: "🖐️",
    label: "Handmade",
    title: "More than half the items sold are handmade",
    legend: "means more than half the items the store sells are handmade.",
  },
  design: {
    emoji: "✒️",
    label: "Original design",
    title: "More than half the items sold are original designs",
    legend: "means more than half the items the store sells are original designs.",
  },
  eco: {
    emoji: "🌿",
    label: "Eco-friendly",
    title: "More than half the items sold are eco-friendly",
    legend: "means more than half the items the store sells are eco-friendly.",
  },
  packGood: {
    emoji: "📦",
    chip: "Good packaging",
    label: "Great packaging/shipping",
    title: "Orders from this seller have shown up well protected",
    legend: "means orders from this seller have shown up well protected.",
  },
  packBad: {
    emoji: "💥",
    label: "Terrible packaging/shipping",
    title: "Orders from this seller have shown up damaged or badly packed",
    legend: "means orders from this seller have shown up damaged or badly packed.",
  },
};

export const SELLER_FILTERS = [
  ...["star", "veteran", "fast", "packGood"].map(key => ({ key, ...SELLER_BADGE[key] })),
  { key: "free", emoji: "💸", chip: "Free shipping" },
];

export const BAR_CLASSES = ["s5", "s4", "s3", "s2", "s1"]; // 5★ … 1★
export const HIDDEN_BADGES = new Set(["local"]);

export const number = value => value.toLocaleString("en-US");

export function regionOf(address) {
  const parts = String(address || "")
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  const country = parts.at(-1);
  if (parts.length < 2 || !/^(United States|USA?)$/i.test(country)) return country;
  return parts.at(-2).replace(/\s+\d{5}(-\d{4})?$/, "");
}

// "150K+" -> 150000
export function soldCount(sold) {
  const scale = /M/i.test(sold) ? 1e6 : /K/i.test(sold) ? 1e3 : 1;
  return parseFloat(sold) * scale;
}

/* ---------- themes ---------- */

const PAGES_THEMES = {
  cayman: "Cayman",
  primer: "Primer",
  minimal: "Minimal",
  architect: "Architect",
  slate: "Slate",
  modernist: "Modernist",
  dinky: "Dinky",
  "leap-day": "Leap Day",
  merlot: "Merlot",
  tactile: "Tactile",
  "time-machine": "Time Machine",
  midnight: "Midnight",
  hacker: "Hacker",
};

const DARK_THEMES = new Set(["dark", "midnight", "hacker"]);

export const THEMES = [
  { id: "auto", name: "Auto", note: "follows your device", icon: "auto" },
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
  { id: "oled", name: "Ultra Dark", icon: "oled" },
  ...Object.entries(PAGES_THEMES).map(([id, name]) => ({ id, name, note: "GitHub Pages" })),
  { id: "random", name: "Random", note: "a new one each visit", icon: "auto" },
].map(theme => ({ icon: DARK_THEMES.has(theme.id) ? "dark" : "light", ...theme }));

export const MODES = new Set(["auto", "random"]);
export const THEME_IDS = THEMES.map(theme => theme.id).filter(id => !MODES.has(id));
