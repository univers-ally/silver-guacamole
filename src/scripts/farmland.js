import { el, delegate, countText, setUpChipRow } from "./dom.js";
import { openTerms } from "./detail.js";
import { byId, copyCode } from "./promos.js";

export function setUpFarmland() {
  const panel = el("farmland");
  if (!panel) return;

  // the primer's Rules are the promo's; an app's carry the app's own id
  delegate(panel, '[data-open="rules"]', button => {
    const primer = button.closest(".primer");
    const entry = primer
      ? byId.get(primer.dataset.id)
      : {
          id: button.dataset.id,
          name: button.dataset.name,
          node: button.closest(".app-sub, .app"),
        };
    if (entry) openTerms(entry);
  });
  delegate(panel, ".primer .code button", copyCode);

  const chips = el("app-chips");
  const list = el("app-list");
  if (!chips || !list) return;
  const count = el("app-count");
  const empty = list.querySelector(".empty");
  const cards = [...list.querySelectorAll(".app")];
  const wanted = new Set(); // rewards

  function render() {
    let shown = 0;
    for (const card of cards) {
      const pays = (card.dataset.rw || "").split(",");
      card.hidden = wanted.size > 0 && !pays.some(reward => wanted.has(reward));
      if (!card.hidden) shown++;
    }
    empty.hidden = shown > 0;
    count.textContent = countText(shown, cards.length, "apps");
  }

  setUpChipRow(chips, wanted, render);
  render();
}
