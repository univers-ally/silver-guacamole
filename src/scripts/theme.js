import { el, delegate } from "./dom.js";
import { store } from "./store.js";
import { openSheet } from "./sheets.js";

// The saved pick is applied before first paint by the inline script in
// Base.astro; this wires the picker and keeps the header button in step.
export function setUpTheme() {
  const button = el("theme");
  const sheet = el("themes");
  const root = document.documentElement;
  const options = new Map(
    [...sheet.querySelectorAll("[data-pick]")].map(option => [option.dataset.pick, option]),
  );
  const themes = [...options.keys()].filter(id => options.get(id).dataset.theme);
  const applied = () => (options.has(root.dataset.theme) ? root.dataset.theme : "auto");
  const chosen = () => (store.get("theme") === "random" ? "random" : applied());
  const randomTheme = () => themes[Math.floor(Math.random() * themes.length)];

  // the <meta theme-color> pair follows the OS until a theme is picked, then
  // both take the page's actual background
  const bars = [...document.querySelectorAll('meta[name="theme-color"]')];
  const osBars = bars.map(meta => meta.content);

  function paint() {
    const mode = chosen();
    const theme = applied();
    const name =
      options.get(mode).dataset.name +
      (mode === "random" ? ` (${options.get(theme).dataset.name})` : "");
    button.setAttribute("aria-label", "Theme: " + name);
    button.title = "Theme: " + name;
    button.dataset.icon = options.get(theme).dataset.icon;
    for (const [id, option] of options) option.setAttribute("aria-pressed", id === mode);
    const paper = theme === "auto" ? null : getComputedStyle(document.body).backgroundColor;
    bars.forEach((meta, i) => (meta.content = paper ?? osBars[i]));
  }

  delegate(sheet, "[data-pick]", option => {
    const pick = option.dataset.pick;
    if (pick === "auto") {
      delete root.dataset.theme;
      store.drop("theme");
    } else {
      root.dataset.theme = pick === "random" ? randomTheme() : pick;
      store.set("theme", pick);
    }
    paint();
    sheet.close();
  });

  button.addEventListener("click", () => openSheet(sheet));
  paint();
}
