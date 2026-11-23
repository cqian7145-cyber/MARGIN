import { useRef, useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Strikethrough,
  Quote,
  List,
  ListOrdered,
  Minus,
  Link2,
  ImagePlus,
  Undo2,
  Redo2,
  Maximize2,
  BookOpen,
  History,
  Check,
  Focus,
} from "lucide-react";
import { PhotoNode, addPhoto } from "./media";
import { db, save, restore, emergency } from "./db";
import {
  fresh,
  kindName,
  count,
  plain,
  safeLink,
  type Entry,
  type Version,
  type Collection,
} from "./model";
export function EditorPage({
  initial,
  collections,
}: {
  initial: Entry;
  collections: Collection[];
}) {
  const key = "margin-draft-" + initial.id;
  const [e, set] = useState<Entry>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(key) || "null") || initial;
    } catch {
      return initial;
    }
  });
  const current = useRef(e),
    dirty = useRef(e !== initial),
    pending = useRef<Promise<boolean> | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [status, stat] = useState(dirty.current ? "待保存" : "已保存"),
    [saveFailed, setSaveFailed] = useState(false),
    [focus, F] = useState(false),
    [hist, H] = useState<Version[] | null>(null),
    [chosen, V] = useState<Version | null>(null),
    [meta, M] = useState(false),
    [selection, S] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    dlg = useRef<HTMLDialogElement>(null);
  function change(p: Partial<Entry>) {
    current.current = { ...current.current, ...p };
    set(current.current);
    dirty.current = true;
    stat("待保存");
    try {
      sessionStorage.setItem(key, JSON.stringify(current.current));
    } catch {
      /* IndexedDB is the primary store. */
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 480);
  }
  async function flush(source = ""): Promise<boolean> {
    if (pending.current) {
      if (!(await pending.current)) return false;
      return flush(source);
    }
    if (!dirty.current && !source) return true;
    const entry = current.current;
    pending.current = (async () => {
      try {
        stat("正在保存");
        const saved = await save(entry, source);
        setSaveFailed(false);
        const changed = current.current !== entry;
        current.current = changed
          ? { ...current.current, revision: saved.revision }
          : saved;
        dirty.current = changed;
        set(current.current);
        if (!changed) {
          try {
            sessionStorage.removeItem(key);
          } catch {
            /* optional recovery copy */
          }
        }
        stat(changed ? "待保存" : "已保存");
        return true;
      } catch (err) {
        setSaveFailed(true);
        stat(String(err));
        return false;
      }
    })();
    const ok = await pending.current;
    pending.current = null;
    if (ok && dirty.current) return flush();
    return ok;
  }
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, isAllowedUri: safeLink },
      }),
      PhotoNode,
    ],
    content: e.doc,
    editorProps: {
      attributes: {
        "aria-label": "文章正文",
        role: "textbox",
        "aria-multiline": "true",
        "data-placeholder": "从这里写起……",
      },
      handleDrop: (_view, ev) => {
        if (!ev.dataTransfer?.files.length) return false;
        ev.preventDefault();
        void images(Array.from(ev.dataTransfer.files));
        return true;
      },
    },
    onUpdate: ({ editor }) => change({ doc: editor.getJSON() }),
    onSelectionUpdate: ({ editor }) => S(!editor.state.selection.empty),
    onBlur: () => {
      void flush();
    },
  });
  async function images(files: File[]) {
    try {
      for (const f of files) {
        const id = await addPhoto(f);
        editor
          ?.chain()
          .focus()
          .insertContent({
            type: "photo",
            attrs: { id, layout: "single", caption: "" },
          })
          .run();
      }
    } catch (err) {
      stat(String(err));
    }
  }
  useEffect(() => {
    document.body.classList.toggle("focused", focus);
    return () => document.body.classList.remove("focused");
  }, [focus]);
  useEffect(() => {
    if (hist) dlg.current?.showModal();
  }, [hist]);
  useEffect(() => {
    const leave = async (ev: MouseEvent) => {
      const a = (ev.target as HTMLElement)?.closest("a");
      if (
        !a ||
        !a.hash.startsWith("#/") ||
        !dirty.current ||
        ev.ctrlKey ||
        ev.metaKey
      )
        return;
      ev.preventDefault();
      ev.stopPropagation();
      if (await flush()) location.hash = a.hash;
    };
    const hide = () => {
      if (document.hidden) void flush();
    };
    document.addEventListener("click", leave, true);
    const keys = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
        ev.preventDefault();
        void flush();
      }
      if (ev.key === "Escape") F(false);
    };
    const unload = (ev: BeforeUnloadEvent) => {
      if (dirty.current) {
        ev.preventDefault();
        ev.returnValue = "";
      }
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("keydown", keys);
    window.addEventListener("beforeunload", unload);
    if (dirty.current) void flush();
    return () => {
      clearTimeout(timer.current);
      void flush();
      document.removeEventListener("click", leave, true);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("keydown", keys);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  async function history() {
    if (await flush()) {
      H(
        (
          await db.versions.where("entryId").equals(e.id).sortBy("at")
        ).reverse(),
      );
      V(null);
    }
  }
  const format = (label: string, icon: React.ReactNode, fn: () => unknown) => (
    <button
      aria-label={label}
      title={label}
      onMouseDown={(ev) => ev.preventDefault()}
      onClick={fn}
    >
      {icon}
    </button>
  );
  const c = () => editor!.chain().focus();
  const inline = editor && (
    <>
      {format("粗体", <Bold />, () => c().toggleBold().run())}
      {format("斜体", <Italic />, () => c().toggleItalic().run())}
      {format("删除线", <Strikethrough />, () => c().toggleStrike().run())}
    </>
  );
  return (
    <section className="edit-page">
      <div className="actions">
        <span className="kicker">{kindName(e.type)} / 写作</span>
        <button onClick={() => F(!focus)}>
          <Maximize2 />
          {focus ? "退出沉浸" : "沉浸"}
        </button>
        <button onClick={history}>
          <History />
          版本
        </button>
        <button
          onClick={async () => {
            if (await flush()) location.hash = "/read/" + e.id;
          }}
        >
          <BookOpen />
          阅读
        </button>
      </div>
      <div className="manuscript">
        <input
          className="title-input"
          aria-label="标题"
          placeholder="无题"
          value={e.title}
          onChange={(v) => change({ title: v.target.value })}
        />
        <button className="meta-link" onClick={() => M(!meta)}>
          {e.date}　·　{meta ? "收起" : "日期与文章信息"} ⌄
        </button>
        {meta && (
          <div className="form-grid">
            <label>
              记录日期
              <input
                type="date"
                value={e.date}
                onChange={(v) =>
                  v.target.value && change({ date: v.target.value })
                }
              />
            </label>
            <label>
              标签（逗号分隔）
              <input
                key={e.id}
                defaultValue={e.tags.join("，")}
                onBlur={(v) =>
                  change({
                    tags: [
                      ...new Set(
                        v.target.value
                          .split(/[,，]/)
                          .map((s) => s.trim())
                          .filter(Boolean),
                      ),
                    ],
                  })
                }
              />
            </label>
            {e.type === "journal" ? (
              <label>
                心情
                <select
                  value={e.mood}
                  onChange={(v) => change({ mood: v.target.value })}
                >
                  {["", "平静", "开心", "忧郁", "焦虑", "感动", "复杂"].map(
                    (x) => (
                      <option key={x} value={x}>
                        {x || "未填写"}
                      </option>
                    ),
                  )}
                </select>
              </label>
            ) : (
              <>
                <label>
                  文章封面
                  <input
                    type="file"
                    accept="image/jpeg,image/webp,image/png"
                    onChange={async (v) => {
                      const f = v.target.files?.[0];
                      if (f)
                        try {
                          change({ cover: await addPhoto(f) });
                        } catch (err) {
                          stat(String(err));
                        }
                    }}
                  />
                </label>
                <label>
                  副标题
                  <input
                    value={e.subtitle}
                    onChange={(v) => change({ subtitle: v.target.value })}
                  />
                </label>
                <label>
                  摘要
                  <input
                    value={e.summary}
                    onChange={(v) => change({ summary: v.target.value })}
                  />
                </label>
                <label>
                  文集
                  <select
                    aria-label="文集"
                    value={e.collection}
                    onChange={(v) => change({ collection: v.target.value })}
                  >
                    <option value="">未归集</option>
                    {collections.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label>
              <input
                type="checkbox"
                checked={e.finished}
                onChange={(v) => change({ finished: v.target.checked })}
              />{" "}
              已完稿
            </label>
            <label>
              <input
                type="checkbox"
                checked={e.favorite}
                onChange={(v) => change({ favorite: v.target.checked })}
              />{" "}
              收藏
            </label>
            <button
              onClick={async () => {
                if (confirm("移入回收站？可在设置中恢复。")) {
                  change({ deleted: true });
                  if (await flush()) location.hash = "/";
                }
              }}
            >
              移入回收站
            </button>
          </div>
        )}
        {editor && (
          <div className="tools">
            {inline}
            <select
              aria-label="段落样式"
              value={
                editor.isActive("heading")
                  ? String(editor.getAttributes("heading").level)
                  : "0"
              }
              onChange={(v) => {
                const l = Number(v.target.value) as 1 | 2 | 3;
                if (l) c().setHeading({ level: l }).run();
                else c().setParagraph().run();
              }}
            >
              {["正文", "标题一", "标题二", "标题三"].map((s, i) => (
                <option value={i} key={s}>
                  {s}
                </option>
              ))}
            </select>
            {format("引用", <Quote />, () => c().toggleBlockquote().run())}
            {format("无序列表", <List />, () => c().toggleBulletList().run())}
            {format("有序列表", <ListOrdered />, () =>
              c().toggleOrderedList().run(),
            )}
            {format("分隔线", <Minus />, () => c().setHorizontalRule().run())}
            {format("链接", <Link2 />, () => {
              const url = prompt("链接地址（HTTPS、HTTP 或 mailto）");
              if (url && safeLink(url)) c().setLink({ href: url }).run();
              else if (url) stat("链接协议无效");
            })}
            {format("插入照片", <ImagePlus />, () => file.current?.click())}
            {format("撤销", <Undo2 />, () => c().undo().run())}
            {format("重做", <Redo2 />, () => c().redo().run())}
          </div>
        )}
        <input
          hidden
          ref={file}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(v) => {
            void images(Array.from(v.target.files || []));
            v.target.value = "";
          }}
        />
        <EditorContent editor={editor} />
        {selection && <div className="selection-tools">{inline}</div>}
        <footer>
          <span>
            {count(plain(e.doc))} 字　约{" "}
            {Math.max(1, Math.ceil(count(plain(e.doc)) / 300))} 分钟
          </span>
          <span role="status">
            <Check />
            {status}
          </span>
        </footer>
        {saveFailed && (
          <div className="actions">
            <button onClick={() => flush()}>重试保存</button>
            <button onClick={() => emergency(e)}>下载草稿</button>
            <button
              onClick={async () => {
                const copy = await save({
                  ...e,
                  id: fresh(e.type).id,
                  revision: 0,
                  title: e.title + "（副本）",
                });
                dirty.current = false;
                sessionStorage.removeItem(key);
                location.hash = "/edit/" + copy.id;
              }}
            >
              另存副本
            </button>
          </div>
        )}
      </div>
      {focus && (
        <button className="exit-focus" onClick={() => F(false)}>
          <Focus />
          退出沉浸
        </button>
      )}
      {hist && (
        <dialog ref={dlg} onClose={() => H(null)}>
          <h2>版本历史</h2>
          <button
            onClick={async () => {
              await flush("手动版本");
              await history();
            }}
          >
            保存当前版本
          </button>
          {hist.map((v) => (
            <button className="version" key={v.id} onClick={() => V(v)}>
              {new Date(v.at).toLocaleString()}　{v.source}
            </button>
          ))}
          {chosen && (
            <>
              <h3>历史内容</h3>
              <p>{chosen.entry.title}</p>
              <pre>{plain(chosen.entry.doc)}</pre>
              <h3>当前内容</h3>
              <pre>{plain(e.doc)}</pre>
              <button
                onClick={async () => {
                  if (
                    confirm("恢复该版本？当前内容将先保存为历史版本。") &&
                    (await flush())
                  ) {
                    try {
                      const next = await restore(current.current, chosen);
                      current.current = next;
                      set(next);
                      editor?.commands.setContent(next.doc, {
                        emitUpdate: false,
                      });
                      dlg.current?.close();
                    } catch (err) {
                      stat(String(err));
                    }
                  }
                }}
              >
                恢复此版本
              </button>
            </>
          )}
          <button onClick={() => dlg.current?.close()}>关闭</button>
        </dialog>
      )}
    </section>
  );
}
