// Entry point, bundled by Astro as a module script (strict and deferred).
// calc.js and the rules data are loaded later, on first use (detail.js).
import { setUpSheets, setUpLightbox } from "./sheets.js";
import { setUpTheme } from "./theme.js";
import { setUpTabs } from "./tabs.js";
import { setUpPromos, syncUrl } from "./promos.js";
import { setUpSellers } from "./sellers.js";
import { setUpFarmland } from "./farmland.js";
import { setUpTimeskip } from "./timeskip.js";

setUpSheets();
setUpLightbox();
setUpTheme();
setUpTabs(syncUrl);
setUpPromos();
setUpSellers();
setUpFarmland();
setUpTimeskip();
