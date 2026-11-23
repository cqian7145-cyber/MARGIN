import Dexie, { type Table } from "dexie";
import {
  defaults,
  type Entry,
  type Version,
  type Photo,
  type Collection,
  type Settings,
  type Tag,
  plain,
} from "./model";
export class Archive extends Dexie {
  tags!: Table<Tag, string>;
  entries!: Table<Entry, string>;
  versions!: Table<Version, string>;
  media!: Table<Photo, string>;
  collections!: Table<Collection, string>;
  preferences!: Table<Settings, string>;
  constructor(name = "margin-studio-v1") {
    super(name);
    this.version(1).stores({
      entries: "id,date,updated,type,*tags",
      versions: "id,entryId,at",
      media: "id",
      collections: "id",
      preferences: "id",
    });
    this.version(2)
      .stores({ tags: "id,&name" })
      .upgrade(async (tx) => {
        const names = new Set<string>();
        await tx
          .table("entries")
          .each((e) => e.tags.forEach((t: string) => names.add(t)));
        await tx.table("tags").bulkAdd(
          Array.from(names, (name) => ({
            id: crypto.randomUUID(),
            name,
            created: new Date().toISOString(),
          })),
        );
      });
  }
}
export const db = new Archive();
export const all = () =>
  db.transaction(
    "r",
    db.entries,
    db.collections,
    db.preferences,
    db.tags,
    async () => ({
      tags: await db.tags.toArray(),
      trash: await db.entries.filter((e) => !!e.deleted).toArray(),
      entries: await db.entries
        .orderBy("updated")
        .reverse()
        .filter((e) => !e.deleted)
        .toArray(),
      collections: await db.collections.toArray(),
      prefs: (await db.preferences.get("reader")) || defaults,
    }),
  );
export function snapshot(e: Entry, source: string): Version {
  return {
    id: crypto.randomUUID(),
    entryId: e.id,
    at: new Date().toISOString(),
    source,
    entry: structuredClone(e),
  };
}
export async function save(e: Entry, source = "", database = db) {
  return database.transaction(
    "rw",
    database.entries,
    database.versions,
    database.tags,
    async () => {
      const prior = await database.entries.get(e.id);
      if ((prior?.revision || 0) !== e.revision)
        throw Error("另一窗口已修改此文。请另存副本以保留两份文字。");
      const next = {
        ...e,
        revision: e.revision + 1,
        updated: new Date().toISOString(),
      };
      const latest = (
        await database.versions.where("entryId").equals(e.id).sortBy("at")
      ).at(-1);
      if (
        (source || !latest || Date.now() - Date.parse(latest.at) > 300000) &&
        (!latest ||
          JSON.stringify({ ...latest.entry, revision: 0, updated: "" }) !==
            JSON.stringify({ ...e, revision: 0, updated: "" }))
      )
        await database.versions.add(snapshot(next, source || "自动快照"));
      for (const name of next.tags) {
        if (!(await database.tags.where({ name }).first()))
          await database.tags.add({
            id: crypto.randomUUID(),
            name,
            created: new Date().toISOString(),
          });
      }
      await database.entries.put(next);
      return next;
    },
  );
}
export async function restore(e: Entry, v: Version) {
  return db.transaction(
    "rw",
    db.entries,
    db.versions,
    db.collections,
    db.tags,
    async () => {
      const prior = await db.entries.get(e.id);
      if (!prior || prior.revision !== e.revision)
        throw Error("版本已变化，请刷新");
      await db.versions.add(snapshot(prior, "恢复前备份"));
      const next = {
        ...v.entry,
        revision: prior.revision + 1,
        updated: new Date().toISOString(),
      };
      if (next.collection && !(await db.collections.get(next.collection)))
        next.collection = "";
      for (const name of next.tags) {
        if (!(await db.tags.where({ name }).first()))
          await db.tags.add({
            id: crypto.randomUUID(),
            name,
            created: next.updated,
          });
      }
      await db.entries.put(next);
      return next;
    },
  );
}
export async function removeCollection(id: string) {
  await db.transaction("rw", db.entries, db.collections, async () => {
    await db.entries
      .filter((e) => e.collection === id)
      .modify((e) => {
        e.collection = "";
        e.revision++;
      });
    await db.collections.delete(id);
  });
}
export async function renameTag(from: string, to: string) {
  await db.transaction("rw", db.tags, db.entries, async () => {
    const tag = await db.tags.where({ name: from }).first();
    if (tag) {
      if (to && !(await db.tags.where({ name: to }).first()))
        await db.tags.update(tag.id, { name: to });
      else if (from !== to) await db.tags.delete(tag.id);
    }
    await db.entries
      .where("tags")
      .equals(from)
      .modify((e) => {
        e.tags = [
          ...new Set(
            e.tags.flatMap((t) => (t === from ? (to ? [to] : []) : [t])),
          ),
        ];
        e.revision++;
      });
  });
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export const emergency = (e: Entry) =>
  download(
    new Blob([e.title + "\n\n" + plain(e.doc)], {
      type: "text/plain;charset=utf-8",
    }),
    "余白-应急草稿.txt",
  );
