# silver-guacamole

Static site built with Astro 7 and served by GitHub Pages. Node 22.12+.

## Commands

| Command           | Does                                             |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | live-reload server on http://127.0.0.1:8000      |
| `npm run build`   | builds to `dist/`                                |
| `npm run preview` | serves `dist/` on :8000                          |
| `npm start`       | build + preview                                  |
| `npm run format`  | Prettier (JS, CSS, YAML, Markdown; not `.astro`) |

The first build encodes ~260 AVIF screenshots (1–2 min). Subsequent builds use `node_modules/.astro/assets`, and CI caches it.

## Where thing go

```
src/content/
  promos/<id>/promo.yaml   single promo with its screenshots
  sellers.yaml
  site.yaml                page-level dates
  tips/*.md                Tips-tab sections
src/content.config.js      schemas for all of above
src/lib/vocab.js           ratings, filter facets, tabs
src/lib/site.js            build vocabulary and helpers
src/lib/content.js         loads the collections, checks across entries
src/components/            markup
src/pages/                 index, 404, rules/calculator JSON, etc
src/scripts/               browser code, one module per feature
src/styles/main.css        imports the partials in cascade order
public/                    copied as-is
```

## Editing content

- **New promo:** add folder `src/content/promos/<id lowercase>/` with `promo.yaml` and its screenshots. Set `order`. Every screenshot should have a `caption`.
- **Screenshots:** 480 px wide WebP, cropped as much as possible. Names are hashed.
- **Validation:** a promo that breaks schema fails the build and names the file and field. That covers: unknown facet values, missing caption, missing image and a `terms` field.
- **Seller:** add entry to `sellers.yaml` and bump `sellers.updated` in `site.yaml`. Avatars go in `public/img/sellers/` as 96 x 96.
- **Tips:** one Markdown file per section with `title` and `order`. A list with `.warn` items as HTML. Screenshots go in front matter `images`.
- **Rules summaries:** summary of the official wording goes in `summary`.

## Deploy

Push to `main`. The workflow in `.github/workflows/deploy.yml` builds, checks no `*.local.*` file got into `dist/`, and uploads it. The Pages source must be "GitHub Actions".