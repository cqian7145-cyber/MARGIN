import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { db, download } from "./db";
import {
  photoIds,
  validDate,
  safeLink,
  type Tag,
  type Entry,
  type Doc,
  type Version,
  type Collection,
  type Settings,
  type Photo,
} from "./model";
export interface Bundle {
  tags: Tag[];
  entries: Entry[];
  versions: Version[];
  media: Photo[];
  collections: Collection[];
  preferences: Settings[];
}
const cap = 256 * 1024 * 1024;
const assert = (ok: unknown) => {
  if (!ok) throw Error("备份结构、内容或关联无效。原档案未更改。");
};
export async function backup() {
  const data = await db.transaction("r", db.tables, async () => ({
    tags: await db.tags.toArray(),
    entries: await db.entries.toArray(),
    versions: await db.versions.toArray(),
    collections: await db.collections.toArray(),
    preferences: await db.preferences.toArray(),
    media: await db.media.toArray(),
  }));
  const files: Record<string, Uint8Array> = {};
  let total = 0;
  const meta = [];
  for (const p of data.media) {
    total += p.blob.size;
    assert(total < cap);
    files["media/" + p.id] = new Uint8Array(await p.blob.arrayBuffer());
    meta.push({ id: p.id, name: p.name, type: p.blob.type });
  }
  for (const [key, val] of Object.entries({
    ...data,
    media: meta,
    manifest: { app: "MARGIN", version: 1 },
  }))
    files[key + ".json"] = strToU8(JSON.stringify(val));
  assert(Object.values(files).reduce((n, v) => n + v.length, 0) < cap);
  return new Blob([new Uint8Array(zipSync(files, { level: 0 }))], {
    type: "application/zip",
  });
}
export async function exportBackup() {
  download(
    await backup(),
    "MARGIN-" + new Date().toISOString().slice(0, 10) + ".zip",
  );
}
const id = (s: unknown) =>
  typeof s === "string" && /^[a-z0-9-]{1,80}$/i.test(s);
function validDoc(n: Doc, depth = 0): boolean {
  return (
    !!n &&
    depth < 48 &&
    [
      "doc",
      "paragraph",
      "text",
      "heading",
      "blockquote",
      "bulletList",
      "orderedList",
      "listItem",
      "hardBreak",
      "horizontalRule",
      "codeBlock",
      "photo",
    ].includes(n.type || "") &&
    (n.type !== "text" || typeof n.text === "string") &&
    (n.type !== "photo" ||
      (id(n.attrs?.id) &&
        ["single", "wide", "half"].includes(n.attrs?.layout || "single") &&
        typeof (n.attrs?.caption ?? "") === "string")) &&
    (n.marks || []).every(
      (m) =>
        ["bold", "italic", "strike", "underline", "code", "link"].includes(
          m.type,
        ) &&
        (m.type !== "link" || safeLink(m.attrs?.href)),
    ) &&
    (n.content || []).every((c) => validDoc(c, depth + 1))
  );
}
export async function inspect(file: Blob): Promise<Bundle> {
  assert(file.size < cap);
  let total = 0;
  const seen = new Set<string>();
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (f) => {
      total += f.originalSize;
      assert(
        total <= cap &&
          !seen.has(f.name) &&
          seen.size < 24000 &&
          /^(manifest|entries|versions|preferences|collections|media|tags)\.json$|^media\/[a-z0-9-]{1,80}$/i.test(
            f.name,
          ),
      );
      seen.add(f.name);
      return true;
    },
  });
  const json = (n: string) => JSON.parse(strFromU8(files[n + ".json"]));
  const manifest = json("manifest");
  assert(manifest.app === "MARGIN" && manifest.version === 1);
  const list = (n: string) => {
    const rows = json(n);
    assert(
      Array.isArray(rows) &&
        rows.every((x: any) => x && id(x.id)) &&
        new Set(rows.map((x: any) => x.id)).size === rows.length,
    );
    return rows;
  };
  const media: Photo[] = list("media").map((m: any) => {
    const bytes = files["media/" + m.id];
    assert(
      bytes &&
        typeof m.name === "string" &&
        ["image/jpeg", "image/webp", "image/png"].includes(m.type),
    );
    return {
      id: m.id,
      name: m.name,
      blob: new Blob([new Uint8Array(bytes)], { type: m.type }),
    };
  });
  const ids = new Set(media.map((m) => m.id));
  const collections: Collection[] = list("collections");
  assert(
    collections.every(
      (c) =>
        typeof c.name === "string" &&
        typeof c.description === "string" &&
        (!c.cover || ids.has(c.cover)),
    ),
  );
  const check = (e: Entry) =>
    e &&
    id(e.id) &&
    ["journal", "essay"].includes(e.type) &&
    ["title", "subtitle", "summary", "collection", "mood", "date"].every(
      (k) => typeof e[k as keyof Entry] === "string",
    ) &&
    (!e.cover || ids.has(e.cover)) &&
    validDate(e.date) &&
    Number.isFinite(Date.parse(e.updated)) &&
    Number.isFinite(Date.parse(e.created)) &&
    typeof e.finished === "boolean" &&
    typeof e.favorite === "boolean" &&
    Number.isInteger(e.revision) &&
    e.revision >= 0 &&
    Array.isArray(e.tags) &&
    e.tags.every((t) => typeof t === "string") &&
    e.doc?.type === "doc" &&
    validDoc(e.doc) &&
    photoIds(e.doc).every((v) => ids.has(v));
  const entries: Entry[] = list("entries");
  assert(
    entries.every(
      (e) =>
        check(e) &&
        (!e.collection || collections.some((c) => c.id === e.collection)),
    ),
  );
  const versions: Version[] = list("versions");
  assert(
    versions.every(
      (v) =>
        check(v.entry) &&
        typeof v.source === "string" &&
        Number.isFinite(Date.parse(v.at)) &&
        v.entryId === v.entry.id &&
        entries.some((e) => e.id === v.entryId),
    ),
  );
  const preferences: Settings[] = list("preferences");
  assert(
    preferences.every(
      (p) =>
        p.id === "reader" &&
        ["serif", "sans-serif"].includes(p.font) &&
        p.size >= 14 &&
        p.size <= 28 &&
        p.line >= 1.4 &&
        p.line <= 2.6 &&
        p.width >= 480 &&
        p.width <= 960 &&
        ["left", "justify"].includes(p.align) &&
        typeof p.reduce === "boolean" &&
        (p.compressPhotos === undefined ||
          typeof p.compressPhotos === "boolean"),
    ),
  );
  const tags: Tag[] = files["tags.json"]
    ? list("tags")
    : [...new Set(entries.flatMap((e) => e.tags))].map((name) => ({
        id: crypto.randomUUID(),
        name,
        created: new Date().toISOString(),
      }));
  assert(
    tags.every(
      (t) => typeof t.name === "string" && typeof t.created === "string",
    ),
  );
  return { entries, versions, media, collections, preferences, tags };
}
export async function importBundle(b: Bundle, replace: boolean) {
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) {
      const rows = b[table.name as keyof Bundle];
      const previous = new Map<string, Entry>();
      if (replace && table.name === "entries") {
        for (const e of await db.entries.toArray()) previous.set(e.id, e);
      }
      if (replace) await table.clear();
      for (const row of rows) {
        const existing = await table.get(row.id);
        if (!existing) {
          const prior = previous.get(row.id);
          if (prior && JSON.stringify(prior) !== JSON.stringify(row)) {
            await table.add({
              ...row,
              revision: Math.max(prior.revision, (row as Entry).revision) + 1,
            });
          } else if (
            table.name !== "tags" ||
            !(await db.tags.where({ name: (row as Tag).name }).first())
          )
            await table.add(row);
          continue;
        }
        if (table.name === "preferences") continue;
        if (table.name === "media") {
          const a = new Uint8Array(
              await DexieWait(existing.blob.arrayBuffer()),
            ),
            z = new Uint8Array(
              await DexieWait((row as Photo).blob.arrayBuffer()),
            );
          if (a.length === z.length && a.every((v, i) => v === z[i])) continue;
        } else if (JSON.stringify(existing) === JSON.stringify(row)) continue;
        throw Error(
          "合并发现同 ID 的不同内容，已取消整次导入。可先备份再选择替换。",
        );
      }
    }
  });
}
import Dexie from "dexie";
function DexieWait(p: Promise<ArrayBuffer>) {
  return Dexie.waitFor(p);
}
