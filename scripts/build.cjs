"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "dist");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const assets = new Set([
  "index.html",
  "manifest.json",
  "icon.svg",
  "service-worker.js",
]);
for (const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)) {
  const file = match[1];
  if (file.startsWith("data:") || file.includes("://") || file.startsWith("#"))
    continue;
  if (!/^[a-z0-9./_-]+$/i.test(file) || file.includes(".."))
    throw Error("Chemin de ressource invalide");
  assets.add(file.replace(/^\.\//, ""));
}
fs.mkdirSync(out, { recursive: true });
for (const file of assets) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) throw Error("Ressource absente : " + file);
  if (file.endsWith(".js"))
    new vm.Script(fs.readFileSync(source, "utf8"), { filename: file });
  fs.copyFileSync(source, path.join(out, file));
}
fs.copyFileSync(path.join(out, "index.html"), path.join(out, "404.html"));
fs.writeFileSync(path.join(out, ".nojekyll"), "");
const bytes = [...assets].reduce(
  (n, f) => n + fs.statSync(path.join(out, f)).size,
  0,
);
fs.writeFileSync(
  path.join(out, "release.json"),
  JSON.stringify(
    {
      name: "BIA Lean Operating System",
      version: require("../package.json").version,
      files: [...assets],
      bytes,
    },
    null,
    2,
  ),
);
console.log(
  `${assets.size} ressources vérifiées et copiées dans dist (${Math.round(bytes / 1024)} Kio).`,
);
