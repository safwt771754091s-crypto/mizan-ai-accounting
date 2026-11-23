import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("إنشاء شركة", () => {
  test("المالك ينشئ شركة فيُعاد توجيهه إليها مع دليل حسابات جاهز", async ({ page }) => {
    await login(page);
    await page.goto("/companies/new");
    const name = `شركة اختبار ${Date.now().toString().slice(-6)}`;
    await page.getByLabel("اسم الشركة التجاري").fill(name);
    await page.getByLabel("بداية السنة المالية").fill("2025-01-01");
    await page.getByLabel("نهاية السنة المالية").fill("2025-12-31");
    await page.getByRole("button", { name: "إنشاء الشركة" }).click();

    await expect(page).toHaveURL(/\/companies\/[^/]+\?company=/);
    await expect(page.getByRole("heading", { name })).toBeVisible();

    await page.getByRole("link", { name: "دليل الحسابات" }).first().click();
    await expect(page.getByText("1010")).toBeVisible();
    await expect(page.getByText("إيرادات المبيعات").first()).toBeVisible();
  });
});
