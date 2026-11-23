import { Organize } from "./organize";
import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Feather,
  ChevronLeft,
  ChevronRight,
  Plus,
  Layers,
  CalendarDays,
  BookMarked,
} from "lucide-react";
import { save, db, removeCollection } from "./db";
import {
  fresh,
  kindName,
  localDay,
  titleOf,
  plain,
  count,
  matches,
  norm,
  anniversary,
  yearDays,
  photoIds,
  type Tag,
  type Kind,
  type Entry,
  type Collection,
} from "./model";
import { exportPdf } from "./reader";
import { PhotoView, addPhoto } from "./media";
export type Data = { tags: Tag[]; entries: Entry[]; collections: Collection[] };
export async function create(type: Kind, date = localDay()) {
  try {
    const e = await save(fresh(type, date));
    location.hash = "/edit/" + e.id;
  } catch (err) {
    alert("创建失败：" + String(err));
  }
}
export function Heading({
  english,
  title,
  children,
}: {
  english: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="heading">
      <div>
        <small>{english}</small>
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <BookOpen size={24} />
      <p>{children}</p>
    </div>
  );
}
function Mark({ s, q }: { s: string; q: string }) {
  const i = q ? norm(s).indexOf(norm(q)) : -1;
  return i < 0 ? (
    s
  ) : (
    <>
      {s.slice(0, i)}
      <mark>{s.slice(i, i + q.length)}</mark>
      {s.slice(i + q.length)}
    </>
  );
}
export function Rows({
  rows,
  q = "",
  grid = false,
}: {
  rows: Entry[];
  q?: string;
  grid?: boolean;
}) {
  const [limit, L] = useState(40);
  return (
    <div className={grid ? "entry-grid" : "entry-list"}>
      {rows.slice(0, limit).map((e) => {
        const body = e.summary || plain(e.doc),
          i = q ? norm(body).indexOf(norm(q)) : -1;
        const preview = body.slice(
          Math.max(0, i - 22),
          Math.max(0, i - 22) + 105,
        );
        return (
          <article className="entry" key={e.id}>
            {(e.cover || photoIds(e.doc)[0]) && (
              <div className="row-thumb">
                <PhotoView id={(e.cover || photoIds(e.doc)[0])!} />
              </div>
            )}
            <span className="stamp">{e.date.replaceAll("-", ".")}</span>
            <a href={"#/read/" + e.id}>
              <h3>
                <Mark s={titleOf(e)} q={q} />
              </h3>
              <p>
                <Mark s={preview} q={q} />
              </p>
            </a>
            <small>
              {kindName(e.type)}
              {e.tags.map((t) => "　#" + t).join("")}
              {e.favorite ? "　✦" : ""}
            </small>
            <span className="edited-at">
              {new Date(e.updated).toLocaleString("zh-CN", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              编辑　
            </span>
            <a className="text-link" href={"#/edit/" + e.id}>
              继续编辑 ↗
            </a>
          </article>
        );
      })}
      {rows.length > limit && (
        <button onClick={() => L(limit + 40)}>再看 40 篇</button>
      )}
    </div>
  );
}
function Timeline({ rows }: { rows: Entry[] }) {
  const [limit, L] = useState(40);
  const groups = new Map<string, Entry[]>();
  for (const row of rows.slice(0, limit)) {
    const m = row.date.slice(0, 7);
    groups.set(m, [...(groups.get(m) || []), row]);
  }
  return (
    <>
      {Array.from(groups, ([month, items]) => (
        <section key={month}>
          <h2 className="month-heading">
            {month.slice(0, 4)} 年 · {Number(month.slice(5))} 月
          </h2>
          <Rows rows={items} />
        </section>
      ))}
      {rows.length > limit && (
        <button onClick={() => L(limit + 40)}>加载更早的文字</button>
      )}
    </>
  );
}
export function Home({ entries }: Data) {
  const date = new Date(),
    hour = date.getHours(),
    greet =
      hour < 5
        ? "夜深了"
        : hour < 11
          ? "早上好"
          : hour < 14
            ? "中午好"
            : hour < 18
              ? "下午好"
              : "晚上好";
  const memories = anniversary(entries);
  return (
    <>
      <div className="desk-top">
        <span>我的书房</span>
        <a href="#/search">搜索档案　⌕</a>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <div className="dateline">
            {date.toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </div>
          <h1>
            写在此刻<span>。</span>
          </h1>
          <p>{greet}，给今天留下一点文字。</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => create("journal")}>
              <BookOpen />
              写一篇日记
            </button>
            <button onClick={() => create("essay")}>
              <Feather />
              写一篇随笔
            </button>
          </div>
        </div>
      </section>
      <div className="section-title">
        <h2>案头书册</h2>
        <span>Writing desk</span>
      </div>
      <div className="shelves">
        {(["journal", "essay"] as Kind[]).map((k, i) => {
          const rows = entries.filter((e) => e.type === k);
          return (
            <div className={"shelf s" + i} key={k}>
              <div className="cover" aria-hidden>
                <span>{i ? "Essays" : "Journal"}</span>
                <i>✧</i>
              </div>
              <div>
                <small>{rows.length} 篇</small>
                <h2>
                  <a href={"#/" + k}>{i ? "随笔集" : "日记簿"}</a>
                </h2>
                <p>{i ? "收拢散落的想法" : "按日珍藏生活片段"}</p>
              </div>
              <a
                className="shelf-open"
                aria-label={"打开" + kindName(k)}
                href={"#/" + k}
              >
                <ArrowUpRight />
              </a>
            </div>
          );
        })}
      </div>
      <div className="section-title">
        <h2>最近留下的文字</h2>
        <a href="#/timeline">时间档案 ↗</a>
      </div>
      {entries.length ? (
        <Rows
          rows={entries.filter((e) =>
            entries
              .filter((x) => x.type === e.type)
              .slice(0, 3)
              .some((x) => x.id === e.id),
          )}
        />
      ) : (
        <Empty>第一篇写下后，会出现在这里。</Empty>
      )}
      {entries.some((e) => !e.finished) && (
        <details>
          <summary>
            继续草稿（{entries.filter((e) => !e.finished).length}）
          </summary>
          <Rows rows={entries.filter((e) => !e.finished).slice(0, 6)} />
        </details>
      )}
      {memories.length > 0 && (
        <>
          <h2>那年今日</h2>
          <Rows rows={memories} />
        </>
      )}
    </>
  );
}
export function ArchivePage({
  entries,
  collections,
  mode,
}: { mode: string } & Data) {
  const [q, Q] = useState(""),
    [tag, T] = useState(""),
    [kind, K] = useState(""),
    [month, M] = useState(""),
    [year, Y] = useState(""),
    [day, D] = useState(""),
    [col, C] = useState(
      new URLSearchParams(location.hash.split("?")[1]).get("collection") || "",
    ),
    [filter, F] = useState(""),
    [sort, O] = useState(
      mode === "journal" || mode === "timeline" ? "date" : "updated",
    ),
    [grid, G] = useState(false);
  const fixed = ["journal", "essay"].includes(mode) ? mode : kind;
  const rows = entries
    .filter(
      (e) =>
        (!fixed || e.type === fixed) &&
        matches(e, q, collections) &&
        (!tag || e.tags.includes(tag)) &&
        (!year || e.date.startsWith(year)) &&
        (!month || e.date.startsWith(month)) &&
        (!day || e.date === day) &&
        (!col || e.collection === col) &&
        (!filter || (filter === "draft" ? !e.finished : e.favorite)),
    )
    .sort((a, b) =>
      sort === "title"
        ? titleOf(a).localeCompare(titleOf(b), "zh")
        : String(b[sort as "date"]).localeCompare(String(a[sort as "date"])),
    );
  const names: Record<string, string[]> = {
    journal: ["Journal", "私人日记"],
    essay: ["Essays", "随笔集"],
    timeline: ["Timeline", "时间档案"],
    search: ["Search", "搜索档案"],
  };
  return (
    <>
      <Heading english={names[mode][0]} title={names[mode][1]}>
        {fixed && (
          <button className="primary" onClick={() => create(fixed as Kind)}>
            <Plus />写{kindName(fixed as Kind)}
          </button>
        )}
      </Heading>
      <div className="filters">
        <input
          aria-label="关键词"
          type="search"
          autoFocus={mode === "search"}
          placeholder="搜索标题、正文、标签或文集"
          value={q}
          onChange={(e) => Q(e.target.value)}
        />
        {!["essay", "journal"].includes(mode) && (
          <select
            aria-label="类型"
            value={kind}
            onChange={(e) => K(e.target.value)}
          >
            <option value="">全部类型</option>
            <option value="journal">日记</option>
            <option value="essay">随笔</option>
          </select>
        )}
        <select
          aria-label="标签筛选"
          value={tag}
          onChange={(e) => T(e.target.value)}
        >
          <option value="">全部标签</option>
          {[...new Set(entries.flatMap((e) => e.tags))].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          aria-label="记录年份"
          value={year}
          onChange={(v) => Y(v.target.value)}
        >
          <option value="">全部年份</option>
          {[...new Set(entries.map((e) => e.date.slice(0, 4)))]
            .sort()
            .reverse()
            .map((y) => (
              <option key={y}>{y}</option>
            ))}
        </select>
        <input
          aria-label="月份"
          type="month"
          value={month}
          onChange={(e) => M(e.target.value)}
        />
        {mode === "search" && (
          <input
            aria-label="确切日期"
            type="date"
            value={day}
            onChange={(e) => D(e.target.value)}
          />
        )}
        <select
          aria-label="文集筛选"
          value={col}
          onChange={(e) => C(e.target.value)}
        >
          <option value="">全部文集</option>
          {collections.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="状态"
          value={filter}
          onChange={(e) => F(e.target.value)}
        >
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="favorite">收藏</option>
        </select>
        <select
          aria-label="排序"
          value={sort}
          onChange={(e) => O(e.target.value)}
        >
          {[
            ["updated", "最近编辑"],
            ["date", "记录日期"],
            ["created", "创建日期"],
            ["title", "标题"],
          ].map(([v, s]) => (
            <option key={v} value={v}>
              {s}
            </option>
          ))}
        </select>
        {mode === "essay" && (
          <button onClick={() => G(!grid)}>{grid ? "列表" : "网格"}</button>
        )}
      </div>
      {rows.length ? (
        (mode === "journal" || mode === "timeline") && sort === "date" && !q ? (
          <Timeline rows={rows} />
        ) : (
          <Rows rows={rows} q={q} grid={grid} />
        )
      ) : (
        <Empty>
          {entries.length
            ? "没有符合这些条件的文字。"
            : "书册还是空的。写下第一篇，就能在这里重读。"}
        </Empty>
      )}
    </>
  );
}
export function Collections({ entries, collections, tags }: Data) {
  return (
    <>
      <Heading english="Collections" title="文集与标签">
        <button
          onClick={async () => {
            const name = prompt("新文集名称")?.trim();
            if (name)
              await db.collections.add({
                id: crypto.randomUUID(),
                name,
                description: "",
              });
          }}
        >
          <Plus />
          新建文集
        </button>
      </Heading>
      {collections.length === 0 && (
        <Empty>把同一主题的随笔收进一本自己的文集。</Empty>
      )}
      {collections.map((c) => {
        const rows = entries.filter((e) => e.collection === c.id);
        return (
          <article className="collection" key={c.id}>
            {c.cover && <PhotoView id={c.cover} />}
            <Layers />
            <h2>
              <a href={"#/essay?collection=" + c.id}>{c.name}</a>
            </h2>
            <p>{c.description}</p>
            <div className="actions">
              <small>{rows.length} 篇随笔</small>
              <button
                onClick={async () => {
                  const name = prompt("文集名称", c.name)?.trim();
                  if (!name) return;
                  const description = prompt("文集描述", c.description);
                  if (description !== null)
                    await db.collections.put({ ...c, name, description });
                }}
              >
                编辑文集
              </button>
              <label className="button">
                设置封面
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/webp,image/png"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      await db.collections.update(c.id, {
                        cover: await addPhoto(f),
                      });
                  }}
                />
              </label>
              <button
                disabled={!rows.length}
                onClick={() => exportPdf(rows, c.name)}
              >
                导出 PDF
              </button>
              <button
                onClick={() => {
                  if (confirm("删除文集？文章将保留。"))
                    void removeCollection(c.id);
                }}
              >
                删除文集
              </button>
            </div>
          </article>
        );
      })}
      <Organize entries={entries} collections={collections} tags={tags} />
    </>
  );
}
export function Calendar({
  entries,
  stats = false,
}: {
  entries: Entry[];
  stats?: boolean;
}) {
  const [selected, D] = useState(localDay()),
    [month, M] = useState(selected.slice(0, 7)),
    [year, Y] = useState(+month.slice(0, 4));
  const dayMap = new Map<string, Entry[]>();
  for (const e of entries) {
    const d = stats ? localDay(new Date(e.created)) : e.date;
    dayMap.set(d, [...(dayMap.get(d) || []), e]);
  }
  const start = new Date(month + "-01T12:00:00");
  const shift = (n: number) => {
    start.setMonth(start.getMonth() + n);
    M(localDay(start).slice(0, 7));
  };
  const days = yearDays(year),
    monthdays = yearDays(start.getFullYear()).filter((d) =>
      d.startsWith(month),
    );
  const trend = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 29 + i);
    return (dayMap.get(localDay(d)) || []).length;
  });
  return (
    <>
      <Heading
        english={stats ? "Insights" : "Calendar"}
        title={stats ? "写作足迹" : "写作日历"}
      />
      {stats ? (
        <>
          <div className="metrics">
            {[
              ["日记", entries.filter((e) => e.type === "journal").length],
              ["随笔", entries.filter((e) => e.type === "essay").length],
              [
                "当前总字数",
                entries.reduce((n, e) => n + count(plain(e.doc)), 0),
              ],
              ["创作日", dayMap.size],
              [
                "本月创建",
                entries.filter((e) =>
                  localDay(new Date(e.created)).startsWith(
                    localDay().slice(0, 7),
                  ),
                ).length,
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <b>{v}</b>
                <small>{k}</small>
              </div>
            ))}
          </div>
          <h2>近 30 天创建篇数</h2>
          <div className="trend">
            {trend.map((n, i) => (
              <i
                key={i}
                title={n + " 篇"}
                style={{
                  height: Math.max(2, (n / Math.max(1, ...trend)) * 76),
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="actions">
            <button aria-label="上个月" onClick={() => shift(-1)}>
              <ChevronLeft />
            </button>
            <h2>{month}</h2>
            <button aria-label="下个月" onClick={() => shift(1)}>
              <ChevronRight />
            </button>
          </div>
          <div className="calendar">
            {Array.from("一二三四五六日").map((d) => (
              <small key={d}>{d}</small>
            ))}
            {monthdays.map((d, i) => {
              const rows = dayMap.get(d) || [];
              return (
                <button
                  key={d}
                  className={d === selected ? "on" : ""}
                  style={
                    !i
                      ? { gridColumnStart: ((start.getDay() + 6) % 7) + 1 }
                      : {}
                  }
                  onClick={() => D(d)}
                >
                  {+d.slice(-2)}
                  <small>
                    {rows.some((e) => e.type === "journal") ? "记" : ""}
                    {rows.some((e) => e.type === "essay") ? "文" : ""}
                  </small>
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="section-title">
        <h2>年度{stats ? "创作" : "记录"}</h2>
        <div className="actions">
          <button
            aria-label="上一年"
            disabled={year <= 1900}
            onClick={() => Y(year - 1)}
          >
            <ChevronLeft />
          </button>
          <span>{year}</span>
          <button
            aria-label="下一年"
            disabled={year >= 2200}
            onClick={() => Y(year + 1)}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="heat-scroll">
        <div className="heat">
          {days.map((d, i) => {
            const rows = dayMap.get(d) || [];
            const label =
              d +
              " · " +
              rows.length +
              " 篇 · 当前 " +
              rows.reduce((s, e) => s + count(plain(e.doc)), 0) +
              " 字";
            return (
              <button
                aria-label={label}
                title={label}
                key={d}
                data-level={Math.min(3, rows.length)}
                style={
                  i === 0
                    ? {
                        gridRowStart:
                          ((new Date(d + "T12:00").getDay() + 6) % 7) + 1,
                      }
                    : {}
                }
                onClick={() => {
                  D(d);
                  M(d.slice(0, 7));
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="section-title">
        <h2>{selected}</h2>
        {!stats && (
          <button onClick={() => create("journal", selected)}>
            写当天日记
          </button>
        )}
      </div>
      {dayMap.has(selected) ? (
        <Rows rows={dayMap.get(selected)!} />
      ) : (
        <Empty>这一天还没有记录。</Empty>
      )}
    </>
  );
}
export function Memories({ entries }: Data) {
  const rows = anniversary(entries),
    old = entries.filter((e) => e.date < localDay());
  return (
    <>
      <Heading english="Memories" title="那年今日" />
      <div className="memory">
        <CalendarDays />
        <h2>往年的今天</h2>
        {rows.length ? (
          <Rows rows={rows} />
        ) : (
          <p>当往年同一天留下过文字，它会在这里重现。</p>
        )}
      </div>
      <div className="section-title">
        <h2>重读旧文</h2>
        <button
          disabled={!old.length}
          onClick={() =>
            (location.hash =
              "/read/" + old[Math.floor(Math.random() * old.length)].id)
          }
        >
          <BookMarked />
          随机翻开
        </button>
      </div>
      <Rows rows={old.slice(0, 8)} />
    </>
  );
}
