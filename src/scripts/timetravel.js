import { el, h } from "./dom.js";
import { confetti } from "./feedback.js";

// timetravel helper (Tips tab)

const HOUR = 3600e3;
const DAY = 24 * HOUR;

// [UTC offset, standard name, daylight-saving name]
const ZONES = [
  [14, "Line Islands Time (LINT)"],
  [13, "Tonga Time (TOT)", "New Zealand Daylight Time (NZDT)"],
  [12, "New Zealand Standard Time (NZST)"],
  [11, "Solomon Islands Time (SBT)", "Australian Eastern Daylight Time (AEDT)"],
  [10, "Australian Eastern Standard Time (AEST)"],
  [9, "Japan Standard Time (JST)"],
  [8, "Hong Kong Time (HKT)"],
  [7, "Indochina Time (ICT)"],
  [6, "Alma-Ata Time (ALMT)"],
  [5, "Pakistan Standard Time (PKT)"],
  [4, "Gulf Standard Time (GST)"],
  [3, "Moscow Standard Time (MSK)", "Eastern European Summer Time (EEST)"],
  [2, "Eastern European Time (EET)", "Central European Summer Time (CEST)"],
  [1, "Central European Time (CET)", "British Summer Time (BST)"],
  [0, "Greenwich Mean Time (GMT)", "Azores Summer Time (AZOST)"],
  [-1, "Azores Standard Time (AZOT)"],
  [-2, "Fernando de Noronha Time (FNT)"],
  [-3, "Argentina Time (ART)", "Atlantic Daylight Time (ADT)"],
  [-4, "Atlantic Standard Time (AST)", "Eastern Daylight Time (EDT)"],
  [-5, "Eastern Standard Time (EST)", "Central Daylight Time (CDT)"],
  [-6, "Central Standard Time (CST)", "Mountain Daylight Time (MDT)"],
  [-7, "Mountain Standard Time (MST)", "Pacific Daylight Time (PDT)"],
  [-8, "Pacific Standard Time (PST)", "Alaska Daylight Time (AKDT)"],
  [-9, "Alaska Standard Time (AKST)"],
  [-10, "Hawaii Standard Time (HST)"],
  [-11, "Samoa Standard Time (SST)"],
  [-12, "Anywhere on Earth (AoE)"],
];

// "GMT+05:30", from an offset in minutes east of UTC
function gmtLabel(minutes) {
  const absolute = Math.abs(minutes);
  const pad = n => String(n).padStart(2, "0");
  return `GMT${minutes < 0 ? "-" : "+"}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

// April to October the northern daylight names apply; the rest of the year
// the southern ones (+11, +13) do
function zoneName(offset) {
  const month = new Date().getMonth();
  const northernSummer = month >= 3 && month <= 9;
  const [, standard, daylight] = ZONES.find(zone => zone[0] === offset);
  const usesDaylight = northernSummer ? offset <= 3 && offset >= -8 : offset >= 11;
  return (usesDaylight && daylight) || standard;
}

const zoneLabel = offset => `${gmtLabel(offset * 60)} ${zoneName(offset)}`;

const clock = ms => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function relative(ms) {
  const minutes = Math.ceil(ms / 60e3);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function localZoneName(style) {
  try {
    return new Intl.DateTimeFormat([], { timeZoneName: style })
      .formatToParts(new Date())
      .find(part => part.type === "timeZoneName").value;
  } catch {
    return "";
  }
}

function detectedZone() {
  const long = localZoneName("long");
  const short = localZoneName("short");
  const abbreviation = short && short !== long ? ` (${short})` : "";
  return `${gmtLabel(-new Date().getTimezoneOffset())} ${long}${abbreviation}`;
}

function rolloversAfter(claimedAt) {
  const rollovers = [];
  for (const [offset] of ZONES) {
    const at = Math.floor((claimedAt + offset * HOUR) / DAY) * DAY + DAY - offset * HOUR;
    if (at - claimedAt <= 30 * HOUR) rollovers.push({ offset, at });
  }
  return rollovers.sort((a, b) => a.at - b.at);
}

export function setUpTimetravel() {
  const button = el("tz-claim");
  const output = el("tz-out");
  let claimedAt = null;
  let timer = null;

  function render() {
    const detected = h(
      "div",
      { class: "tz-zone" },
      h("span", {}, "Detected time zone:"),
      " ",
      detectedZone(),
    );
    if (!claimedAt) {
      output.replaceChildren(detected, h("span", {}, "Tap right after you claim."));
      return;
    }

    const now = Date.now();
    const rollovers = rolloversAfter(claimedAt);
    const ready = rollovers.filter(zone => zone.at <= now);
    const upcoming = rollovers.filter(zone => zone.at > now).slice(0, 4);
    const b = text => h("b", {}, text);

    const list = h(
      "div",
      { class: "tz-list" },
      ready.length > 0 && h("div", {}, b("Now"), " switch to ", b(zoneLabel(ready.at(-1).offset))),
      upcoming.map(next =>
        h(
          "div",
          {},
          "In ",
          b(relative(next.at - now)),
          ` (at ${clock(next.at)}) switch to `,
          b(zoneLabel(next.offset)),
        ),
      ),
    );
    const since = h(
      "div",
      { class: "tz-since" },
      h("span", {}, `Last claim ${clock(claimedAt)} (${localZoneName("short")})`),
    );
    output.replaceChildren(detected, list, since);
  }

  button.addEventListener("click", () => {
    claimedAt = Date.now();
    render();
    confetti(button);
    timer ||= setInterval(render, 60e3);
  });

  render();
}
