import { test, expect } from "@playwright/test";
test("two tabs preserve concurrent edits and quota failures retain a downloadable draft", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByText("写一篇日记", { exact: true }).click();
  const body = page.getByLabel("文章正文");
  await body.fill("共同的起点");
  await expect(page.getByRole("status")).toHaveText("已保存");
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.getByLabel("文章正文")).toHaveText("共同的起点");
  await body.fill("第一窗口");
  await expect(page.getByRole("status")).toHaveText("已保存");
  await other.getByLabel("文章正文").fill("第二窗口");
  await expect(other.getByRole("status")).toContainText("另一窗口");
  await other.getByText("另存副本", { exact: true }).click();
  await expect(other.getByLabel("标题", { exact: true })).toHaveValue(/副本/);
  await page.reload();
  await expect(body).toHaveText("第一窗口");
  await page.evaluate(() => {
    const write = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === "entries")
        throw new DOMException("模拟写入失败", "QuotaExceededError");
      return write.call(this, value, key);
    };
  });
  await body.fill("空间不足也要保留");
  await expect(page.getByRole("status")).toContainText("Quota");
  await expect(body).toHaveText("空间不足也要保留");
  const downloading = page.waitForEvent("download");
  await page.getByText("下载草稿").click();
  expect((await downloading).suggestedFilename()).toMatch(/txt$/);
});
test("collections, rich text and offline reload", async ({
  page,
  context,
}, info) => {
  await page.goto("/#/collections");
  page.once("dialog", (d) => d.accept("短篇"));
  await page.getByText("新建文集").click();
  await expect(page.getByRole("heading", { name: "短篇" })).toBeVisible();
  await page.goto("/");
  await page.getByText("写一篇随笔", { exact: true }).click();
  await page.getByLabel("标题", { exact: true }).fill("一页晴光");
  await page.getByText("日期与文章信息", { exact: false }).click();
  await page
    .getByLabel("文集", { exact: true })
    .selectOption({ label: "短篇" });
  const body = page.getByLabel("文章正文");
  await body.fill("一章");
  await body.press("End");
  await page.getByLabel("段落样式").selectOption("2");
  await body.press("End");
  await body.press("Enter");
  await body.pressSequentially("A quiet afternoon.");
  await page.getByRole("button", { name: "引用", exact: true }).click();
  await expect(body.locator("blockquote")).toContainText("quiet");
  await expect(body.locator("h2")).toContainText("一章");
  await expect(page.getByRole("status")).toHaveText("已保存");
  await page.screenshot({
    path: info.outputPath("editor.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "沉浸", exact: true }).click();
  await page.screenshot({
    path: info.outputPath("focus.png"),
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "版本", exact: true }).click();
  await page.screenshot({
    path: info.outputPath("version.png"),
    animations: "disabled",
  });
  await page.getByText("关闭", { exact: true }).click();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect(body.locator("h2")).toHaveText("一章");
  await context.setOffline(true);
  await page.reload();
  await expect(body.locator("blockquote")).toContainText("quiet");
  await page.getByRole("button", { name: "阅读", exact: true }).click();
  await expect(page.locator(".paper h2")).toHaveText("一章");
  await page.screenshot({
    path: info.outputPath("reader.png"),
    animations: "disabled",
  });
  await page.getByText("书籍视图").click();
  await page.screenshot({
    path: info.outputPath("book.png"),
    animations: "disabled",
  });
});
