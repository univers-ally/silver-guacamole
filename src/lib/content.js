// The site's content, read once from the collections (schemas in
// src/content.config.js), plus the checks that span entries.
import { getCollection, getEntry } from "astro:content";
import { createHash } from "node:crypto";
import { detailData } from "./site.js";

const byOrder = (a, b) => a.data.order - b.data.order;

export const PROMOS = (await getCollection("promos")).sort(byOrder).map(entry => entry.data);
export const SELLERS = (await getCollection("sellers")).sort(byOrder).map(entry => entry.data);

// bump `sellers.updated` in site.yaml whenever sellers.yaml changes
export const SELLERS_UPDATED = (await getEntry("site", "sellers")).data.updated;

export const USED_BADGES = new Set(SELLERS.flatMap(seller => seller.badges));

// App ids become element ids and share the detail data with promo ids, so
// they must be unique across every app and sub-app and never match a promo.
const seen = new Set(PROMOS.map(promo => promo.id));
for (const promo of PROMOS) {
  for (const app of (promo.apps || []).flatMap(parent => [parent, ...(parent.sub || [])])) {
    if (seen.has(app.id)) throw Error(`${promo.id}: app id "${app.id}" is already used`);
    seen.add(app.id);
  }
}

// Rules summaries and calculator configs, fetched on the first Rules or
// Calculator tap. The hash in the file name changes whenever the content does.
export const DETAIL_JSON = JSON.stringify(detailData(PROMOS));
export const DETAIL_FILE = `detail.${createHash("sha1").update(DETAIL_JSON).digest("hex").slice(0, 8)}`;
