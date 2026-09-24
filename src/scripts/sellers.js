import { el, countText, setUpChipRow } from "./dom.js";

const SORTS = {
  default: (a, b) => a.index - b.index,
  rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
  sold: (a, b) => b.sold - a.sold,
  reviews: (a, b) => b.reviews - a.reviews,
};

export function setUpSellers() {
  const list = el("seller-list");
  const count = el("seller-count");
  const sortSelect = el("seller-sort");
  const empty = list.querySelector(".empty");
  const wanted = new Set(); // badge keys, or "free"

  const rows = [...list.querySelectorAll(".seller")].map((node, index) => ({
    node,
    index,
    rating: parseFloat(node.dataset.rating),
    reviews: parseFloat(node.dataset.reviews),
    sold: parseFloat(node.dataset.sold),
    free: node.dataset.free === "1",
    badges: node.dataset.badges.split(" "),
  }));
  const matches = row =>
    [...wanted].every(key => (key === "free" ? row.free : row.badges.includes(key)));

  function render() {
    let shown = 0;
    for (const row of [...rows].sort(SORTS[sortSelect.value])) {
      row.node.hidden = !matches(row);
      if (!row.node.hidden) shown++;
      list.appendChild(row.node);
    }
    list.appendChild(empty);
    empty.hidden = shown > 0;
    count.textContent = countText(shown, rows.length, "sellers");
  }

  // rating bars: the stacked one grows by share, the breakdown ones by width
  for (const bar of list.querySelectorAll(".seller-bars [data-p]")) bar.style.flex = bar.dataset.p;
  for (const bar of list.querySelectorAll(".dist-track [data-p]"))
    bar.style.setProperty("--p", bar.dataset.p + "%");

  setUpChipRow(el("seller-chips"), wanted, render);
  sortSelect.addEventListener("change", render);
  render();
}
