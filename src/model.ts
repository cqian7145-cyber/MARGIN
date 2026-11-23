import type { JSONContent } from "@tiptap/core";
export type Doc = JSONContent;
export type Kind = "journal" | "essay";
export interface Entry {
  deleted?: boolean;
  cover?: string;
  id: string;
  type: Kind;
  title: string;
  subtitle: string;
  summary: string;
  date: string;
  created: string;
  updated: string;
  doc: Doc;
  tags: string[];
  collection: string;
  mood: string;
  favorite: boolean;
  finished: boolean;
  revision: number;
}
export interface Tag {
  id: string;
  name: string;
  created: string;
}
export interface Photo {
  id: string;
  name: string;
  blob: Blob;
}
export interface Collection {
  id: string;
  name: string;
  description: string;
  cover?: string;
}
export interface Version {
  id: string;
  entryId: string;
  at: string;
  source: string;
  entry: Entry;
}
export interface Settings {
  id: string;
  font: string;
  size: number;
  line: number;
  width: number;
  align: "left" | "justify";
  reduce: boolean;
  compressPhotos?: boolean;
}
export const defaults: Settings = {
  id: "reader",
  font: "serif",
  size: 19,
  line: 1.95,
  width: 720,
  align: "left",
  reduce: false,
};
export function localDay(d = new Date()) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
export function fresh(type: Kind, date = localDay()): Entry {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    type,
    title: "",
    subtitle: "",
    summary: "",
    date,
    created: now,
    updated: now,
    doc: { type: "doc", content: [{ type: "paragraph" }] },
    tags: [],
    collection: "",
    mood: "",
    favorite: false,
    finished: false,
    revision: 0,
  };
}
export function plain(d: Doc): string {
  if (d.type === "text") return d.text || "";
  if (d.type === "photo") return String(d.attrs?.caption || "");
  if (d.type === "hardBreak") return "\n";
  return (d.content || [])
    .map(plain)
    .join(["paragraph", "heading"].includes(d.type || "") ? "" : "\n");
}
export function count(s: string) {
  return (
    s.match(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{Script=Latin}\p{N}]+(?:['’-][\p{Script=Latin}\p{N}]+)*/gu,
    ) || []
  ).length;
}
export const titleOf = (e: Entry) =>
  e.title.trim() ||
  plain(e.doc)
    .trim()
    .split(/[。！？\n]/)[0]
    ?.slice(0, 55) ||
  "无题";
export const norm = (s: string) => s.normalize("NFKC").toLocaleLowerCase();
export function matches(e: Entry, q: string, collections: Collection[]) {
  return norm(
    [
      e.title,
      e.subtitle,
      e.summary,
      plain(e.doc),
      ...e.tags,
      collections.find((c) => c.id === e.collection)?.name || "",
    ].join("\n"),
  ).includes(norm(q.trim()));
}
export function anniversary(entries: Entry[], today = localDay()) {
  return entries.filter(
    (e) => e.date < today && e.date.slice(5) === today.slice(5),
  );
}
export function yearDays(year: number) {
  const days: string[] = [];
  for (
    let d = new Date(year, 0, 1, 12);
    d.getFullYear() === year;
    d.setDate(d.getDate() + 1)
  )
    days.push(localDay(d));
  return days;
}
export function validDate(s: string) {
  return (
    /^\d{4}-\d\d-\d\d$/.test(s) && localDay(new Date(s + "T12:00:00")) === s
  );
}
export function safeLink(s: string) {
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(s).protocol);
  } catch {
    return false;
  }
}
export function photoIds(doc: Doc): string[] {
  return [
    ...(doc.type === "photo" ? [String(doc.attrs?.id)] : []),
    ...(doc.content || []).flatMap(photoIds),
  ];
}
export const kindName = (t: Kind) => (t === "journal" ? "日记" : "随笔");
