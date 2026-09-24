// @ts-check
import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";

export default defineConfig({
  site: "https://shoreskies.com",
  devToolbar: { enabled: false },
  markdown: {
    processor: satteri({ features: { smartPunctuation: false } }),
    syntaxHighlight: false,
  },
  security: {
    csp: {
      directives: [
        "default-src 'none'",
        "img-src 'self'",
        "connect-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
      ],
    },
  },
  vite: {
    build: {
      cssTarget: ["safari17.5", "firefox120", "chrome123"],
      sourcemap: true,
      assetsInlineLimit: 0,
    },
  },
});
