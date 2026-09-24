import { el } from "./dom.js";

export function setUpFooter() {
  const tip = el("tip");
  if (!tip) return;
  const base = tip.href;
  const refresh = () => {
    const url = new URL(base);
    for (const [key, value] of new URLSearchParams(location.search))
      if (key !== "origin") url.searchParams.append(key, value);
    url.hash = location.hash;
    tip.href = url.href;
  };
  tip.addEventListener("click", refresh);
  tip.addEventListener("auxclick", refresh);
}
