import { jsPDF } from "jspdf";
import { db } from "./db";
import { titleOf, kindName, type Entry, type Doc } from "./model";
let font: Promise<string> | undefined;
async function fontData() {
  const r = await fetch(import.meta.env.BASE_URL + "fonts/MarginSC.ttf");
  if (!r.ok) throw Error("离线字体未就绪，请重新打开应用");
  const bytes = new Uint8Array(await r.arrayBuffer());
  const parts = [];
  for (let i = 0; i < bytes.length; i += 8192)
    parts.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  return btoa(parts.join(""));
}
export async function pdf(entries: Entry[], name: string) {
  if (!entries.length) throw Error("请先选择文章");
  const p = new jsPDF({ unit: "pt", compress: true, putOnlyUsedFonts: true });
  font ??= fontData().catch((err) => {
    font = undefined;
    throw err;
  });
  p.addFileToVFS("MarginSC.ttf", await font);
  p.addFont("MarginSC.ttf", "Margin", "normal");
  p.setFont("Margin");
  let y = 72;
  const room = (h: number) => {
    if (y + h > 766) {
      p.addPage();
      y = 72;
    }
  };
  function lines(s: string, size: number, indent = 0) {
    p.setFontSize(size);
    let row = "",
      width = 0;
    const emit = () => {
      room(size * 1.65);
      p.text(row, 54 + indent, y);
      y += size * 1.65;
      row = "";
      width = 0;
    };
    for (const c of Array.from(s)) {
      if (c === "\n") {
        emit();
        continue;
      }
      const w = p.getTextWidth(c);
      if (row && width + w > 485 - indent) emit();
      row += c;
      width += w;
    }
    if (row) emit();
  }
  async function block(n: Doc, indent = 0, prefix = "") {
    if (n.type === "photo") {
      const m = await db.media.get(n.attrs?.id);
      if (!m) throw Error("文章引用的照片缺失");
      const im = await createImageBitmap(m.blob);
      const scale = Math.min(480 / im.width, 500 / im.height, 1);
      const w = im.width * scale,
        h = im.height * scale;
      const c = document.createElement("canvas");
      c.width = Math.min(1500, im.width);
      c.height = Math.round((c.width * im.height) / im.width);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(im, 0, 0, c.width, c.height);
      im.close();
      room(h + 20);
      p.addImage(c.toDataURL("image/jpeg", 0.88), "JPEG", 54, y, w, h);
      y += h + 16;
      lines(n.attrs?.caption || "", 10);
      return;
    }
    if (["paragraph", "heading", "codeBlock"].includes(n.type || "")) {
      lines(
        prefix +
          (n.content || [])
            .map((t) => (t.type === "hardBreak" ? "\n" : t.text || ""))
            .join(""),
        n.type === "heading" ? 19 : 12,
        indent,
      );
      y += 7;
      return;
    }
    if (n.type === "horizontalRule") {
      room(18);
      p.setDrawColor(170);
      p.line(54, y, 530, y);
      y += 18;
      return;
    }
    let i = 0;
    for (const child of n.content || []) {
      await block(
        child,
        indent + (n.type === "blockquote" || n.type === "listItem" ? 15 : 0),
        n.type === "orderedList"
          ? String(++i) + ". "
          : n.type === "bulletList"
            ? "• "
            : prefix,
      );
      prefix = "";
    }
  }
  for (const [i, e] of entries.entries()) {
    if (i) p.addPage();
    y = 66;
    lines(kindName(e.type) + "   /   " + e.date, 10);
    y += 10;
    lines(titleOf(e), 25);
    if (e.subtitle) lines(e.subtitle, 15);
    y += 16;
    if (e.cover) await block({ type: "photo", attrs: { id: e.cover } });
    await block(e.doc);
  }
  const pages = p.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    p.setPage(i);
    p.setFontSize(9);
    p.text("MARGIN   /   " + i + " — " + pages, 54, 808);
  }
  p.save(
    (name.trim() || "余白文集")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\.pdf$/i, "") + ".pdf",
  );
}
