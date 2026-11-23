import { useState } from "react";
import { db, renameTag } from "./db";
import { titleOf, type Tag, type Entry, type Collection } from "./model";
export function Organize({
  entries,
  tags,
  collections,
}: {
  entries: Entry[];
  tags: Tag[];
  collections: Collection[];
}) {
  const [name, N] = useState(""),
    [picked, P] = useState<string[]>([]),
    [selected, S] = useState(""),
    [collection, C] = useState(""),
    [msg, M] = useState("");
  async function assign(action: "add" | "remove" | "collection") {
    try {
      await db.transaction("rw", db.entries, async () => {
        for (const id of picked) {
          const e = await db.entries.get(id);
          if (!e || e.deleted) continue;
          if (action === "collection" && e.type === "essay")
            e.collection = collection;
          else if (action === "add")
            e.tags = [...new Set([...e.tags, selected])];
          else if (action === "remove")
            e.tags = e.tags.filter((t) => t !== selected);
          else continue;
          e.revision++;
          e.updated = new Date().toISOString();
          await db.entries.put(e);
        }
      });
      M("已更新所选文章");
    } catch (err) {
      M(String(err));
    }
  }
  return (
    <section className="settings">
      <h2>标签管理</h2>
      <form
        className="actions"
        onSubmit={async (e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          try {
            if (!(await db.tags.where({ name: n }).first()))
              await db.tags.add({
                id: crypto.randomUUID(),
                name: n,
                created: new Date().toISOString(),
              });
            N("");
          } catch (err) {
            M(String(err));
          }
        }}
      >
        <input
          aria-label="新标签"
          placeholder="标签名称"
          value={name}
          onChange={(e) => N(e.target.value)}
        />
        <button>创建标签</button>
      </form>
      {tags.map((t) => (
        <button
          key={t.id}
          title="重命名、合并或删除"
          onClick={async () => {
            const n = prompt(
              "重命名；输入已有标签可合并，留空可移除。",
              t.name,
            );
            if (n !== null)
              try {
                await renameTag(t.name, n.trim());
              } catch (err) {
                M(String(err));
              }
          }}
        >
          #{t.name}
        </button>
      ))}
      <details>
        <summary>批量整理文章</summary>
        <div className="pick-entries">
          {entries.map((e) => (
            <label key={e.id}>
              <input
                type="checkbox"
                checked={picked.includes(e.id)}
                onChange={(v) =>
                  P(
                    v.target.checked
                      ? [...picked, e.id]
                      : picked.filter((x) => x !== e.id),
                  )
                }
              />
              {titleOf(e)}
            </label>
          ))}
        </div>
        <div className="actions">
          <select
            aria-label="批量标签"
            value={selected}
            onChange={(e) => S(e.target.value)}
          >
            <option value="">选择标签</option>
            {tags.map((t) => (
              <option key={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            disabled={!picked.length || !selected}
            onClick={() => assign("add")}
          >
            添加标签
          </button>
          <button
            disabled={!picked.length || !selected}
            onClick={() => assign("remove")}
          >
            移除标签
          </button>
        </div>
        <div className="actions">
          <select
            aria-label="批量文集"
            value={collection}
            onChange={(v) => C(v.target.value)}
          >
            <option value="">移出文集</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            disabled={!picked.length}
            onClick={() => assign("collection")}
          >
            应用到所选随笔
          </button>
        </div>
      </details>
      <p role="status">{msg}</p>
    </section>
  );
}
