import { el } from "./dom.js";
import { TABS } from "../lib/vocab.js";

const IDS = TABS.map(tab => tab.id);
const scrollPositions = {};
let current = IDS[0];
let onUserSwitch = () => {};

export const currentTab = () => current;

// fromUser: a click or keypress, as opposed to reading the url on load. Only
// those update the url and restore the tab's own scroll position
export function showTab(id, fromUser) {
  if (!IDS.includes(id)) id = IDS[0];
  scrollPositions[current] = scrollY;
  for (const tab of IDS) {
    el(tab).hidden = tab !== id;
    const button = el("tab-" + tab);
    button.setAttribute("aria-selected", tab === id);
    button.tabIndex = tab === id ? 0 : -1;
  }
  current = id;
  if (fromUser) {
    onUserSwitch();
    scrollTo(0, scrollPositions[id] || 0);
  }
}

const KEY_STEP = { ArrowRight: 1, ArrowLeft: -1, Home: -IDS.length, End: IDS.length };

export function setUpTabs(onSwitch) {
  onUserSwitch = onSwitch;
  IDS.forEach((tab, index) => {
    const button = el("tab-" + tab);
    button.addEventListener("click", () => showTab(tab, true));
    button.addEventListener("keydown", event => {
      const step = KEY_STEP[event.key];
      if (!step) return;
      event.preventDefault();
      const next = IDS[Math.min(IDS.length - 1, Math.max(0, index + step))];
      showTab(next, true);
      el("tab-" + next).focus();
    });
  });
  addEventListener("hashchange", () => showTab(location.hash.slice(1)));
}
