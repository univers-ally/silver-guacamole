import { DETAIL_FILE, DETAIL_JSON } from "../lib/content.js";

export const getStaticPaths = () => [{ params: { detail: DETAIL_FILE } }];

export const GET = () =>
  new Response(DETAIL_JSON, { headers: { "Content-Type": "application/json" } });
