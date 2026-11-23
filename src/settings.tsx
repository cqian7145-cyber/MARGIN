import { useEffect, useState } from "react";
import { Heading } from "./archive";
import { db } from "./db";
import { exportBackup, inspect, importBundle, type Bundle } from "./backup";
import { titleOf, type Entry, type Settings } from "./model";
export function SettingsPage({
  prefs,
  trash,
}: {
  prefs: Settings;
  trash: Entry[];
}) {
  const [b, B] = useState<Bundle | null>(null),
    [msg, S] = useState(""),
    [used, U] = useState(""),
    [busy, W] = useState(false);
  useEffect(() => {
    navigator.storage
      ?.estimate()
      .then((s) => U(((s.usage || 0) / 1048576).toFixed(1) + " MB"));
  }, []);
  const update = (p: Partial<Settings>) =>
    db.preferences.put({ ...prefs, ...p });
  async function task(fn: () => Promise<unknown>, success: string) {
    W(true);
    try {
      await fn();
      S(success);
    } catch (e) {
      S(String(e));
    } finally {
      W(false);
    }
  }
  return (
    <>
      <Heading english="Preferences" title="书房设置" />
      <section className="settings">
        <h2>阅读与写作</h2>
        <label>
          正文字体
          <select
            value={prefs.font}
            onChange={(e) => update({ font: e.target.value })}
          >
            <option value="serif">衬线 · 宋体</option>
            <option value="sans-serif">无衬线 · 黑体</option>
          </select>
        </label>
        {(
          [
            ["字号", "size", 14, 28, 1],
            ["行距", "line", 1.4, 2.6, 0.05],
            ["版心宽度", "width", 480, 960, 20],
          ] as const
        ).map(([s, k, min, max, step]) => (
          <label key={k}>
            {s}　{prefs[k]}
            <input
              aria-label={s}
              type="range"
              min={min}
              max={max}
              step={step}
              value={prefs[k]}
              onChange={(e) => update({ [k]: +e.target.value })}
            />
          </label>
        ))}
        <label>
          段落对齐
          <select
            value={prefs.align}
            onChange={(e) =>
              update({ align: e.target.value as Settings["align"] })
            }
          >
            <option value="left">左对齐</option>
            <option value="justify">两端对齐</option>
          </select>
        </label>
        <label>
          减少动效
          <input
            type="checkbox"
            checked={prefs.reduce}
            onChange={(e) => update({ reduce: e.target.checked })}
          />
        </label>
      </section>
      <section className="settings">
        <h2>本地档案</h2>
        <p>
          文字、照片和版本保存在当前浏览器的这个站点。清理站点数据或更换域名、浏览器及设备后，需要从备份恢复。照片默认按原始质量保存。
        </p>
        <label>
          压缩新照片（最长边 2400 像素，仅保留较小版本）
          <input
            type="checkbox"
            checked={prefs.compressPhotos ?? false}
            onChange={(e) => update({ compressPhotos: e.target.checked })}
          />
        </label>
        <small>站点当前占用　{used || "暂不可用"}</small>
        <div className="actions">
          <button
            disabled={busy}
            onClick={() => task(exportBackup, "备份已生成")}
          >
            导出 ZIP 备份
          </button>
          <label className="button">
            选择备份文件
            <input
              type="file"
              accept=".zip"
              hidden
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                B(null);
                if (f)
                  void task(
                    async () => B(await inspect(f)),
                    "请核对待导入内容",
                  );
              }}
            />
          </label>
        </div>
        {b && (
          <div>
            <h3>导入预览</h3>
            <p>
              {b.entries.length} 篇文字 · {b.media.length} 张照片 ·{" "}
              {b.collections.length} 本文集 · {b.versions.length} 个版本
            </p>
            <button
              disabled={busy}
              onClick={() =>
                task(async () => {
                  await importBundle(b, false);
                  B(null);
                }, "已合并档案")
              }
            >
              合并导入
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "完全替换本机档案，包括所有文字、照片和版本？建议先导出当前备份。",
                  )
                )
                  void task(async () => {
                    await importBundle(b, true);
                    B(null);
                  }, "已替换档案");
              }}
            >
              完全替换
            </button>
            <button onClick={() => B(null)}>取消</button>
          </div>
        )}
        <p role="status">{msg}</p>
      </section>
      <section className="settings">
        <h2>回收站</h2>
        {trash.length ? (
          trash.map((e) => (
            <p key={e.id}>
              {titleOf(e)}　
              <button
                onClick={() =>
                  db.entries.update(e.id, {
                    deleted: false,
                    revision: e.revision + 1,
                  })
                }
              >
                移回书房
              </button>
            </p>
          ))
        ) : (
          <p>回收站为空。</p>
        )}
      </section>
    </>
  );
}
