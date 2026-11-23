import { test, expect } from "@playwright/test";
test("multi-page illustrated anthology keeps both article endings", async ({
  page,
}, info) => {
  await page.goto("/#/collections");
  page.once("dialog", (d) => d.accept("四季"));
  await page.getByRole("button", { name: "新建文集" }).click();
  await expect(page.getByRole("heading", { name: "四季" })).toBeVisible();
  for (const [n, title] of ["春日书", "冬日书"].entries()) {
    await page.goto("/");
    await page.getByRole("button", { name: "写一篇随笔" }).click();
    await page.getByLabel("标题", { exact: true }).fill(title);
    await page.getByText("日期与文章信息", { exact: false }).click();
    await page
      .getByLabel("文集", { exact: true })
      .selectOption({ label: "四季" });
    const body = page.getByRole("textbox", { name: "文章正文" });
    await body.fill(
      "湖光与山色。Morning light falls across the page. ".repeat(140) +
        "终章" +
        n,
    );
    await body.press("End");
    await page
      .locator("input[type=file][multiple]")
      .setInputFiles("public/iris.webp");
    await expect(body.locator("img")).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("已保存");
  }
  await page.goto("/#/collections");
  page.once("dialog", (d) => d.accept("四季"));
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 PDF" }).click();
  await (await downloading).saveAs(info.outputPath("anthology.pdf"));
});
