import { defineCollection } from "astro:content";
import { glob, file } from "astro/loaders";
import { z } from "astro/zod";
import { RATING, FACETS, TAB_LABEL } from "./lib/vocab.js";
import { REWARDS, SELLER_BADGE } from "./lib/site.js";

const date = z.iso.date(); // "2026-09-22", quoted in YAML

const noTerms = z
  .never({ error: "Temu's wording belongs in rules.local.js; write a `summary` instead" })
  .optional();

// "Cash", or "Cash*" for "not always offered"
const facet = name => {
  const allowed = FACETS[name].options.map(([value]) => value);
  return z
    .array(
      z.string().refine(value => allowed.includes(value.replace(/\*$/, "")), {
        error: `must be one of ${allowed.join(", ")}, optionally ending in *`,
      }),
    )
    .optional();
};

const rule = z.strictObject({ t: z.string(), warn: z.boolean().optional() });

const calcField = z.strictObject({
  k: z.string(),
  label: z.string(),
  value: z.string(),
  step: z.string().optional(),
  dp: z.string().optional(),
  type: z.literal("check").optional(),
  row: z.string().optional(),
  icon: z.enum(["b", "y"]).optional(),
  tag: z.string().optional(),
});

// the keys are documented in the project notes (Calculators)
const calc = z.strictObject({
  note: z.string().optional(),
  formula: z.string().optional(),
  tpl: z.union([z.string(), z.array(z.union([z.string(), z.array(z.string())]))]).optional(),
  fields: z.array(calcField),
  derived: z.record(z.string(), z.string()).optional(),
  rows: z.boolean().optional(),
  out: z.string().optional(),
  fmt: z.enum(["money", "money2"]).optional(),
  f: z.string(),
  hint: z.string().optional(),
});

const promos = defineCollection({
  loader: glob({
    pattern: "*/promo.yaml",
    base: "./src/content/promos",
    generateId: ({ data }) => String(data.id),
  }),
  schema: ({ image }) => {
    const shot = z.strictObject({ src: image(), caption: z.string().min(1) });
    const appFields = {
      id: z.string().regex(/^[a-z0-9-]+$/, "lowercase letters, digits and dashes"),
      name: z.string(),
      blurb: z.string().optional(),
      icon: image().optional(),
      banner: image().optional(),
      rewards: z.array(z.enum(Object.keys(REWARDS))).optional(),
      rules: z.array(rule).optional(),
      images: z.array(shot).optional(),
      date: date.optional(),
      summary: z.string().optional(),
      terms: noTerms,
    };
    const app = z.strictObject({
      ...appFields,
      sub: z.array(z.strictObject(appFields)).optional(),
    });

    return z
      .strictObject({
        id: z.string(),
        order: z.number(), // default sort; leave gaps (10, 20, ...)
        name: z.string(),
        codes: z.array(z.string()),
        rating: z.enum(Object.keys(RATING)).optional(), // omitted = meh
        type: facet("type"),
        accepts: facet("accepts"),
        payout: facet("payout"),
        date: date.optional(),
        reward: z.string().optional(), // HTML
        summary: z.string().optional(),
        rules: z.array(rule).optional(),
        images: z.array(shot).optional(),
        calc: calc.optional(),
        pending: z.boolean().optional(),
        tab: z.enum(Object.keys(TAB_LABEL)).optional(),
        apps: z.array(app).optional(),
        terms: noTerms,
      })
      .refine(promo => !promo.apps || promo.tab, "only a promo with a `tab` can have `apps`");
  },
});

const sellers = defineCollection({
  loader: file("./src/content/sellers.yaml"),
  schema: z.strictObject({
    id: z.string(),
    order: z.number(), // default sort; leave gaps (10, 20,...)
    name: z.string(),
    url: z.url(),
    biz: z.string(),
    address: z.string(),
    website: z.url({ protocol: /^https?$/ }).nullable(),
    avatar: z
      .string()
      .regex(/^\/img\/sellers\/[\w.-]+$/, "a file in public/img/sellers, as /img/sellers/<name>"), // 96×96
    badges: z.array(z.enum(Object.keys(SELLER_BADGE))),
    sold: z.string(), // "150K+"
    rating: z.number(),
    reviews: z.number().int(),
    shipping: z.string(),
    bars: z.array(z.number()).length(5), // % of 5★ … 1★ reviews
  }),
});

const tips = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/tips" }),
  schema: ({ image }) =>
    z.strictObject({
      title: z.string(),
      order: z.number(),
      images: z
        .array(z.strictObject({ src: image(), alt: z.string(), caption: z.string().min(1) }))
        .optional(),
    }),
});

const site = defineCollection({
  loader: file("./src/content/site.yaml"),
  schema: z.strictObject({ updated: date }),
});

export const collections = { promos, sellers, tips, site };
