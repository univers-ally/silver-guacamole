import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BUILD = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(BUILD, "..");
const SITE = path.join(ROOT, "site");
const PORT = Number(process.argv[2] || process.env.PORT || 8000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const MOUNT = "/build/";

function resolve(url) {
  let clean;
  try {
    clean = path.posix.normalize(decodeURIComponent(url.split("?")[0].split("#")[0]));
  } catch {
    return null; // malformed percent-encoding
  }
  const underBuild = clean.startsWith(MOUNT);
  const base = underBuild ? BUILD : SITE;
  const full = path.resolve(base, clean.slice(underBuild ? MOUNT.length : 1));
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) return path.join(full, "index.html");
  return full;
}

http.createServer((req, res) => {
  const file = resolve(req.url);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`404  ${req.url}\n`);
    return;
  }
  res.writeHead(200, {
    "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store, must-revalidate",
  });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1", () => {
  if (!fs.existsSync(SITE)) console.log("site/ does not exist yet -- run npm run build");
  console.log(`serving site/ at http://127.0.0.1:${PORT}/`);
}).on("error", error => {
  if (error.code === "EADDRINUSE") {
    console.error(`port ${PORT} is already in use -- pass another, e.g. node build/serve.js 8001`);
    process.exit(1);
  }
  throw error;
});
