import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const paths = (await readdir("dist", { recursive: true, withFileTypes: true }))
  .filter((f) => f.isFile() && f.name !== "sw.js")
  .map((f) =>
    (f.parentPath + "/" + f.name)
      .replaceAll("\\", "/")
      .replace(/^.*?dist\//, ""),
  )
  .sort();
const hash = createHash("sha256");
for (const p of paths) hash.update(await readFile("dist/" + p));
await writeFile(
  "dist/sw.js",
  `const prefix="margin-"+encodeURIComponent(self.registration.scope)+"-";const key=prefix+${JSON.stringify(hash.digest("hex").slice(0, 14))};const scope=self.registration.scope;const files=${JSON.stringify(paths)}.map(p=>new URL(p,scope).href);self.addEventListener('install',e=>e.waitUntil(caches.open(key).then(c=>c.addAll(files))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(prefix)&&k!==key).map(k=>caches.delete(k))))));self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!e.request.url.startsWith(scope))return;e.respondWith(caches.open(key).then(async c=>(await c.match(e.request.mode==='navigate'?new URL('index.html',scope).href:e.request.url,{ignoreVary:true}))||fetch(e.request)))})`,
);
