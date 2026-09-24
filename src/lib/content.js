import { getCollection, getEntry } from "astro:content";
import { createHash } from "node:crypto";
import { detailData } from "./site.js";

const byOrder = (a, b) => a.data.order - b.data.order;

export const PROMOS = (await getCollection("promos")).sort(byOrder).map(entry => entry.data);
export const SELLERS = (await getCollection("sellers")).sort(byOrder).map(entry => entry.data);

export const SELLERS_UPDATED = (await getEntry("site", "sellers")).data.updated;

export const USED_BADGES = new Set(SELLERS.flatMap(seller => seller.badges));

const seen = new Set(PROMOS.map(promo => promo.id));
for (const promo of PROMOS) {
  for (const app of (promo.apps || []).flatMap(parent => [parent, ...(parent.sub || [])])) {
    if (seen.has(app.id)) throw Error(`${promo.id}: app id "${app.id}" is already used`);
    seen.add(app.id);
  }
}

export const DETAIL_JSON = JSON.stringify(detailData(PROMOS));
export const DETAIL_FILE = `detail.${createHash("sha1").update(DETAIL_JSON).digest("hex").slice(0, 8)}`;
