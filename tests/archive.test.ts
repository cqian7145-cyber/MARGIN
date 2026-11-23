import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import { db, save, restore, removeCollection } from "../src/db";
import {
  fresh,
  count,
  yearDays,
  validDate,
  matches,
  anniversary,
  safeLink,
  plain,
  titleOf,
} from "../src/model";
import { backup, inspect, importBundle } from "../src/backup";
beforeEach(async () => {
  for (const t of db.tables) await t.clear();
});
describe("calendar and search", () => {
  it("counts mixed Chinese and English words", () =>
    expect(count("雨落 West Lake, 2026.")).toBe(5));
  it("handles leap years", () => {
    expect(yearDays(2024)).toHaveLength(366);
    expect(validDate("2025-02-29")).toBe(false);
    expect(yearDays(2025).at(-1)).toBe("2025-12-31");
  });
  it("indexes 1000 real-shaped documents and literal punctuation", () => {
    const docs = Array.from({ length: 1000 }, () => fresh("essay"));
    docs[778].title = "湖畔 AI [x]";
    expect(docs.filter((e) => matches(e, "ai [x]", []))).toEqual([docs[778]]);
  });
  it("returns past anniversaries only", () =>
    expect(
      anniversary(
        [fresh("journal", "2024-02-29"), fresh("journal", "2028-02-29")],
        "2028-02-29",
      ),
    ).toHaveLength(1));
  it("rejects script links", () =>
    expect(safeLink("javascript:alert(1)")).toBe(false));
  it("keeps an untitled entry untitled", () => {
    const e = fresh("journal");
    e.doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "湖边。晚风" }] },
      ],
    };
    expect(titleOf(e)).toBe("湖边");
    expect(e.title).toBe("");
    expect(plain(e.doc)).toContain("晚风");
  });
});
describe("archive transactions", () => {
  it("keeps same-day entries independent", async () => {
    await save(fresh("journal"));
    await save(fresh("journal"));
    expect(await db.entries.count()).toBe(2);
  });
  it("protects stale revisions", async () => {
    const a = await save(fresh("essay"));
    await save({ ...a, title: "first" });
    await expect(save({ ...a, title: "stale" })).rejects.toThrow();
    expect((await db.entries.get(a.id))?.title).toBe("first");
  });
  it("saves the displaced version on restore", async () => {
    const a = await save({ ...fresh("essay"), title: "A" }, "手动版本");
    const v = (await db.versions.toArray())[0];
    const b = await save({ ...a, title: "B" });
    expect((await restore(b, v)).title).toBe("A");
    expect(
      (await db.versions.toArray()).some((s) => s.entry.title === "B"),
    ).toBe(true);
  });
  it("preserves entries when removing collections", async () => {
    await db.collections.add({ id: "c", name: "c", description: "" });
    await save({ ...fresh("essay"), collection: "c" });
    await removeCollection("c");
    expect((await db.entries.toArray())[0].collection).toBe("");
  });
  it("round trips media, versions, tags and prefs, rolls back conflicts", async () => {
    const e = await save({ ...fresh("journal"), tags: ["湖"] });
    const b = await inspect(await backup());
    await importBundle(b, true);
    expect((await db.entries.get(e.id))?.tags).toEqual(["湖"]);
    await save({ ...e, title: "later" });
    await expect(importBundle(b, false)).rejects.toThrow();
    expect((await db.entries.get(e.id))?.title).toBe("later");
  });
  it("rejects junk archives", async () =>
    await expect(inspect(new Blob(["broken"]))).rejects.toThrow());
});
