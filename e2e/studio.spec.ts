import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
test("journal persists with date, formatting, history, photo, PDF and ZIP", async ({
  page,
  browser,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "写一篇日记" }).click();
  await page.getByLabel("标题", { exact: true }).fill("湖畔手记");
  const body = page.getByRole("textbox", { name: "文章正文" });
  await body.fill("秋日 West Lake，晚风轻轻。");
  await page.getByText("日期与文章信息", { exact: false }).click();
  await page.getByLabel("记录日期").fill("2024-02-29");
  await page.getByLabel("标签（逗号分隔）").fill("杭州，漫步");
  await page.getByLabel("标签（逗号分隔）").press("Tab");
  await expect(page.getByRole("status")).toHaveText("已保存");
  await page.reload();
  await expect(body).toContainText("West Lake");
  await expect(page.locator(".meta-link")).toContainText("2024-02-29");
  await page.getByRole("button", { name: "版本", exact: true }).click();
  await page.getByText("保存当前版本").click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await body.fill("大雪之后 After snow。");
  await page.getByRole("button", { name: "版本", exact: true }).click();
  await page.getByText("手动版本", { exact: false }).first().click();
  await expect(page.getByRole("dialog")).toContainText("West Lake");
  page.once("dialog", (d) => d.accept());
  await page.getByText("恢复此版本").click();
  await expect(body).toContainText("West Lake");
  await page.locator("input[type=file]").setInputFiles("public/iris.webp");
  await expect(page.locator(".ProseMirror img")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("已保存");
  await page.reload();
  await expect(page.locator(".ProseMirror img")).toBeVisible();
  await page.getByRole("button", { name: "阅读", exact: true }).click();
  await expect(page.locator("article img")).toBeVisible();
  page.once("dialog", (d) => d.accept("书房测试"));
  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 PDF" }).click();
  await (await pdf).saveAs(info.outputPath("sample.pdf"));
  expect((await fs.stat(info.outputPath("sample.pdf"))).size).toBeGreaterThan(
    5000,
  );
  await page.goto("/#/settings");
  const zip = page.waitForEvent("download");
  await page.getByText("导出 ZIP 备份").click();
  const file = info.outputPath("backup.zip");
  await (await zip).saveAs(file);
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto("http://127.0.0.1:4196/#/settings");
  await other.locator("input[type=file]").setInputFiles(file);
  await expect(other.getByText("导入预览")).toBeVisible();
  await other.getByText("合并导入").click();
  await expect(other.getByRole("status")).toContainText("已合并");
  await other.goto("http://127.0.0.1:4196/#/journal");
  await other.getByRole("heading", { name: "湖畔手记" }).click();
  await expect(other.locator("article img")).toBeVisible();
  await context.close();
  expect(errors).toEqual([]);
});
for (const w of [375, 390, 768, 1024, 1440])
  test("responsive writing " + w, async ({ page }, info) => {
    await page.setViewportSize({ width: w, height: 850 });
    await page.goto("/");
    await expect(page.getByText("案头书册")).toBeVisible();
    await page.screenshot({ path: info.outputPath("desk.png") });
    await page.getByRole("button", { name: "写一篇随笔" }).click();
    await page.getByLabel("标题", { exact: true }).fill("古城");
    await page
      .getByRole("textbox", { name: "文章正文" })
      .fill("城中下了一场雨。".repeat(220));
    await page.getByRole("button", { name: "沉浸", exact: true }).click();
    await page
      .getByRole("button", { name: "退出沉浸", exact: true })
      .last()
      .click();
    await page.getByRole("button", { name: "阅读", exact: true }).click();
    await page.getByText("书籍视图").click();
    await page.getByLabel("下一页").click();
    await expect(page.locator(".pager")).toContainText("2 /");
    for (const p of [
      "calendar",
      "essay",
      "timeline",
      "insights",
      "memories",
      "collections",
      "settings",
      "search",
    ]) {
      await page.goto("/#/" + p);
      await expect(page.locator(".heading")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (p === "search") {
        await page.getByLabel("关键词").fill("场雨");
        await expect(page.getByRole("heading", { name: "古城" })).toBeVisible();
      }
      await page.screenshot({ path: info.outputPath(p + ".png") });
    }
  });
