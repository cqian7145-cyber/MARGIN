import { useEffect, useState } from "react";
import { Node } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { db } from "./db";
export function PhotoView({
  id,
  caption = "",
  layout = "single",
}: {
  id: string;
  caption?: string;
  layout?: string;
}) {
  const [url, set] = useState("");
  useEffect(() => {
    let live = true,
      src = "";
    set("");
    db.media
      .get(id)
      .then((p) => {
        if (live && p) {
          src = URL.createObjectURL(p.blob);
          set(src);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
      if (src) URL.revokeObjectURL(src);
    };
  }, [id]);
  return (
    <figure className={"photo " + layout}>
      {url ? (
        <img src={url} alt={caption || "文章照片"} />
      ) : (
        <span>照片暂不可用</span>
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
function NodePhoto({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  return (
    <NodeViewWrapper className={"photo-node " + node.attrs.layout}>
      <PhotoView id={node.attrs.id} caption={node.attrs.caption} />
      {selected && (
        <div className="photo-tools" contentEditable={false}>
          <input
            aria-label="照片说明"
            value={node.attrs.caption}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
          />
          <select
            aria-label="照片布局"
            value={node.attrs.layout}
            onChange={(e) => updateAttributes({ layout: e.target.value })}
          >
            <option value="single">单图</option>
            <option value="half">半宽</option>
            <option value="wide">通栏</option>
          </select>
          <button onClick={deleteNode}>移除照片</button>
        </div>
      )}
    </NodeViewWrapper>
  );
}
export const PhotoNode = Node.create({
  name: "photo",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({
    id: { default: "" },
    caption: { default: "" },
    layout: { default: "single" },
  }),
  parseHTML: () => [],
  renderHTML: () => ["figure", { "data-local-photo": "" }],
  addNodeView() {
    return ReactNodeViewRenderer(NodePhoto);
  },
});
export async function addPhoto(file: File) {
  if (
    file.size > 25 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw Error("请选择 25 MB 以内的 JPEG、PNG 或 WebP 照片。");
  const im = await createImageBitmap(file);
  let blob: Blob = file;
  try {
    if ((await db.preferences.get("reader"))?.compressPhotos) {
      const ratio = Math.min(1, 2400 / Math.max(im.width, im.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(im.width * ratio));
      canvas.height = Math.max(1, Math.round(im.height * ratio));
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(im, 0, 0, canvas.width, canvas.height);
        const compressed = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/webp", 0.86),
        );
        if (compressed && compressed.size < blob.size) blob = compressed;
      }
    }
  } finally {
    im.close();
  }
  const id = crypto.randomUUID();
  await db.media.add({ id, name: file.name, blob });
  return id;
}
