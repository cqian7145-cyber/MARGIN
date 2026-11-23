import { useEffect, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import {
  HashRouter,
  Routes,
  Route,
  useLocation,
  useParams,
  NavLink,
} from "react-router";
import { liveQuery } from "dexie";
import {
  Feather,
  BookOpen,
  CalendarDays,
  Layers,
  Clock3,
  ChartNoAxesColumn,
  House,
  Search,
  Settings,
  PanelLeftClose,
  Menu,
  HardDrive,
  X,
  Archive as ArchiveIcon,
} from "lucide-react";
import { all } from "./db";
import { defaults, type Entry, type Tag } from "./model";
import {
  Home,
  ArchivePage,
  Collections,
  Calendar,
  Memories,
  type Data,
} from "./archive";
import { EditorPage } from "./editor";
import { Reader } from "./reader";
import { SettingsPage } from "./settings";
import "./style.css";
const links = [
  ["/", "此刻", House],
  ["/journal", "日记", BookOpen],
  ["/essay", "随笔", Feather],
  ["/collections", "文集", Layers],
  ["/calendar", "日历", CalendarDays],
  ["/timeline", "时间档案", ArchiveIcon],
  ["/memories", "回忆", Clock3],
  ["/search", "搜索", Search],
  ["/insights", "写作足迹", ChartNoAxesColumn],
  ["/settings", "设置", Settings],
] as const;
function Detail({ read, data }: { read: boolean; data: Data }) {
  const { id } = useParams();
  const e = data.entries.find((x) => x.id === id);
  if (!e)
    return (
      <p>
        未找到这篇文字。 <a href="#/">回到此刻</a>
      </p>
    );
  return read ? (
    <Reader key={id} e={e} />
  ) : (
    <EditorPage key={id} initial={e} collections={data.collections} />
  );
}
function Studio() {
  const [data, set] = useState({
      trash: [] as Entry[],
      tags: [] as Tag[],
      entries: [] as Entry[],
      collections: [] as Data["collections"],
      prefs: defaults,
    }),
    [loaded, L] = useState(false),
    [err, E] = useState(""),
    [menu, M] = useState(false),
    [fold, F] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    const sub = liveQuery(all).subscribe({
      next: (v) => {
        set(v);
        L(true);
      },
      error: (e) => E(String(e)),
    });
    return () => sub.unsubscribe();
  }, []);
  useEffect(() => {
    M(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  useEffect(() => {
    document.documentElement.classList.toggle("reduce", data.prefs.reduce);
  }, [data.prefs.reduce]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        location.hash = "/search";
      }
      if (e.key === "Escape") M(false);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <div
      className={"studio " + (fold ? "fold " : "") + (menu ? "menu-open" : "")}
      style={
        {
          "--reader-font":
            data.prefs.font === "serif" ? "var(--serif)" : "var(--sans)",
          "--size": data.prefs.size + "px",
          "--leading": data.prefs.line,
          "--width": data.prefs.width + "px",
          "--align": data.prefs.align,
        } as CSSProperties
      }
    >
      <a
        href="#main"
        className="skip"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        跳到正文
      </a>
      <aside>
        <a href="#/" className="brand">
          <i>M</i>
          <span>
            MARGIN<small>余 白</small>
          </span>
        </a>
        <button
          className="mobile-close"
          aria-label="关闭菜单"
          onClick={() => M(false)}
        >
          <X />
        </button>
        <nav>
          {links.map(([to, s, Icon], i) => (
            <NavLink
              end
              key={to}
              to={to}
              title={s}
              className={({ isActive }) =>
                (isActive ? "active " : "") +
                ([4, 9].includes(i) ? "division" : "")
              }
            >
              <Icon />
              <span>{s}</span>
            </NavLink>
          ))}
        </nav>
        <div className="local">
          <HardDrive />
          <span>本地私人书房</span>
          <button aria-label="折叠导航" onClick={() => F(!fold)}>
            <PanelLeftClose />
          </button>
        </div>
      </aside>
      {menu && (
        <button
          className="scrim"
          aria-label="关闭导航"
          onClick={() => M(false)}
        />
      )}
      <main id="main" tabIndex={-1}>
        <div className="mobile-brand">
          MARGIN <small>余白</small>
        </div>
        {err ? (
          <p role="alert">
            无法打开本地数据库。请检查浏览器的站点存储权限，并重新加载。{err}
          </p>
        ) : !loaded ? (
          <p>正在打开书房…</p>
        ) : (
          <div className="page" key={loc.pathname}>
            <Routes>
              <Route path="/" element={<Home {...data} />} />
              {["journal", "essay", "timeline", "search"].map((mode) => (
                <Route
                  key={mode}
                  path={mode}
                  element={<ArchivePage mode={mode} {...data} />}
                />
              ))}
              <Route path="collections" element={<Collections {...data} />} />
              <Route
                path="calendar"
                element={<Calendar entries={data.entries} />}
              />
              <Route
                path="insights"
                element={<Calendar entries={data.entries} stats />}
              />
              <Route path="memories" element={<Memories {...data} />} />
              <Route
                path="edit/:id"
                element={<Detail data={data} read={false} />}
              />
              <Route path="read/:id" element={<Detail data={data} read />} />
              <Route
                path="settings"
                element={<SettingsPage prefs={data.prefs} trash={data.trash} />}
              />
              <Route
                path="*"
                element={
                  <p>
                    页面不存在。 <a href="#/">返回书房</a>
                  </p>
                }
              />
            </Routes>
          </div>
        )}
      </main>
      <div className="bottom">
        {links.slice(0, 3).map(([to, s, Icon]) => (
          <NavLink end key={to} to={to}>
            <Icon />
            {s}
          </NavLink>
        ))}
        <button onClick={() => M(true)}>
          <Menu />
          更多
        </button>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <HashRouter>
    <Studio />
  </HashRouter>,
);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  });
