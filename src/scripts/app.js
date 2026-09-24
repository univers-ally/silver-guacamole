import { setUpSheets, setUpLightbox } from "./sheets.js";
import { setUpTheme } from "./theme.js";
import { setUpTabs } from "./tabs.js";
import { setUpPromos, syncUrl } from "./promos.js";
import { setUpSellers } from "./sellers.js";
import { setUpFarmland } from "./farmland.js";
import { setUpTimetravel } from "./timetravel.js";
import { setUpFooter } from "./footer.js";

setUpSheets();
setUpLightbox();
setUpTheme();
setUpTabs(syncUrl);
setUpPromos();
setUpSellers();
setUpFarmland();
setUpTimetravel();
setUpFooter();
