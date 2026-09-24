// Shared by the build (site.js) and the browser (scripts/), so it ships to
// every visitor: keep it small and never import content here.

// in "best rated first" order; words are extra search terms
export const RATING = {
  good: { emoji: "🔥", chip: "Worth it", label: "Worth doing", words: "good fire worth" },
  meh: {
    emoji: "💤",
    chip: "Meh",
    label: "Average or low reward",
    words: "meh average low zzz sleep",
  },
  bad: { emoji: "💀", chip: "Avoid", label: "Bad deal / scammy", words: "bad skull scam avoid" },
};

// attr: the card's data- attribute and the url parameter
export const FACETS = {
  rating: {
    label: "Rating",
    attr: "r",
    options: Object.entries(RATING).map(([key, { emoji, chip }]) => [key, `${emoji} ${chip}`]),
  },
  payout: {
    label: "Payout",
    attr: "p",
    options: ["Cash", "Credit", "Coupons", "Discount", "Gift"].map(v => [v, v]),
  },
  accepts: {
    label: "Accepts",
    attr: "a",
    options: ["Credit", "Coupons", "Discounts", "None"].map(v => [v, v]),
  },
  type: {
    label: "Type",
    attr: "t",
    options: ["Daily claim", "Cashout", "Coupon Bundle"].map(v => [v, v]),
  },
};

// promo: a promo can point its `tab` at it, and the panel renders that promo
export const TABS = [
  { id: "promos", label: "Promos" },
  { id: "sellers", label: "Sellers" },
  { id: "tips", label: "Tips & Tricks" },
  { id: "farmland", label: "Farmland", promo: true },
];

export const TAB_LABEL = Object.fromEntries(
  TABS.filter(tab => tab.promo).map(tab => [tab.id, tab.label]),
);
