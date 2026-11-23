import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Download,
  PenLine,
} from "lucide-react";
import { PhotoView } from "./media";
import { type Doc, type Entry, titleOf, kindName, safeLink } from "./model";
export async function exportPdf(entries: Entry[], name: string) {
  const file = prompt("导出 PDF 文件名", name);
  if (!file) return;
  try {
    await (await import("./pdf")).pdf(entries, file);
  } catch (e) {
    alert(String(e));
  }
}
function Block({ n }: { n: Doc }): ReactNode {
  const kids = n.content?.map((x, i) => <Block key={i} n={x} />);
  if (n.type === "text") {
    let out: ReactNode = n.text;
    for (const m of n.marks || []) {
      if (m.type === "bold") out = <strong>{out}</strong>;
      if (m.type === "italic") out = <em>{out}</em>;
      if (m.type === "strike") out = <s>{out}</s>;
      if (m.type === "underline") out = <u>{out}</u>;
      if (m.type === "code") out = <code>{out}</code>;
      if (m.type === "link" && safeLink(m.attrs?.href))
        out = (
          <a href={m.attrs?.href} rel="noreferrer" target="_blank">
            {out}
          </a>
        );
    }
    return out;
  }
  switch (n.type) {
    case "photo":
      return (
        <PhotoView
          id={n.attrs?.id}
          caption={n.attrs?.caption}
          layout={n.attrs?.layout}
        />
      );
    case "heading":
      return n.attrs?.level === 1 ? (
        <h1>{kids}</h1>
      ) : n.attrs?.level === 2 ? (
        <h2>{kids}</h2>
      ) : (
        <h3>{kids}</h3>
      );
    case "paragraph":
      return <p>{kids || <br />}</p>;
    case "blockquote":
      return <blockquote>{kids}</blockquote>;
    case "bulletList":
      return <ul>{kids}</ul>;
    case "orderedList":
      return <ol start={n.attrs?.start}>{kids}</ol>;
    case "listItem":
      return <li>{kids}</li>;
    case "codeBlock":
      return <pre>{kids}</pre>;
    case "hardBreak":
      return <br />;
    case "horizontalRule":
      return <hr />;
    default:
      return <>{kids}</>;
  }
}
export function Reader({ e }: { e: Entry }) {
  const [book, B] = useState(false),
    [page, P] = useState(0),
    [pages, N] = useState(1);
  const box = useRef<HTMLDivElement>(null),
    touch = useRef(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!book || !el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (!w) return;
      const n = Math.max(1, Math.round((el.scrollWidth + 40) / (w + 40)));
      N(n);
      P((v) => Math.min(v, n - 1));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("load", measure, true);
    measure();
    document.fonts.ready.then(measure);
    return () => {
      ro.disconnect();
      el.removeEventListener("load", measure, true);
    };
  }, [book, e]);
  useLayoutEffect(() => {
    if (book && box.current)
      box.current.scrollLeft = page * (box.current.clientWidth + 40);
  }, [page, book, pages]);
  const [direction, dir] = useState(1);
  const turn = (d: number) => {
    dir(d);
    P((v) => Math.min(pages - 1, Math.max(0, v + d)));
  };
  useEffect(() => {
    if (!book) return;
    const key = (v: KeyboardEvent) => {
      if (v.key === "ArrowRight") turn(1);
      if (v.key === "ArrowLeft") turn(-1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [pages, book]);
  return (
    <section>
      <div className="actions">
        <a href={"#/edit/" + e.id}>
          <PenLine />
          编辑
        </a>
        <button
          onClick={() => {
            P(0);
            B(!book);
          }}
        >
          <BookOpen />
          {book ? "连续阅读" : "书籍视图"}
        </button>
        <button onClick={() => exportPdf([e], titleOf(e))}>
          <Download />
          导出 PDF
        </button>
      </div>
      <article
        className={"paper " + (book ? "bound" : "")}
        onTouchStart={(v) => (touch.current = v.touches[0].clientX)}
        onTouchEnd={(v) => {
          const dx = v.changedTouches[0].clientX - touch.current;
          if (book && Math.abs(dx) > 55) turn(dx < 0 ? 1 : -1);
        }}
      >
        <div ref={box} className={book ? "columns prose" : "prose"}>
          <small>
            {e.date}　/　{kindName(e.type)}
          </small>
          <h1>{titleOf(e)}</h1>
          {e.subtitle && <h3>{e.subtitle}</h3>}
          {e.cover && <PhotoView id={e.cover} />}
          <Block n={e.doc} />
        </div>
        {book && (
          <div
            key={page}
            className={direction > 0 ? "leaf" : "leaf reverse"}
            aria-hidden
          />
        )}
      </article>
      {book && (
        <div className="pager">
          <button disabled={!page} onClick={() => turn(-1)} aria-label="上一页">
            <ChevronLeft />
          </button>
          {page + 1} / {pages}
          <button
            disabled={page + 1 >= pages}
            onClick={() => turn(1)}
            aria-label="下一页"
          >
            <ChevronRight />
          </button>
        </div>
      )}
    </section>
  );
}
