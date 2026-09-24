// @ts-check
import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";

export default defineConfig({
  site: "https://shoreskies.com",
  devToolbar: { enabled: false },
  markdown: {
    // keep "straight" quotes in the Tips Markdown as written
    processor: satteri({ features: { smartPunctuation: false } }),
    // no code blocks in the Tips, and Shiki's inline styles would break the CSP
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
      // the oldest supported browsers (the CSS uses light-dark()); also stops the
      // minifier dropping -webkit-backdrop-filter, which Safari 17 needs
      cssTarget: ["safari17.5", "firefox120", "chrome123"],
      // public, with sources: minified is not obfuscated
      sourcemap: true,
      // no data: URLs, which img-src 'self' would block
      assetsInlineLimit: 0,
    },
  },
});
