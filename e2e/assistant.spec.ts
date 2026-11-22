import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("المساعد يجيب بأرقام فعلية من بيانات الشركة", async ({ page }) => {
  await login(page);
  await page.goto("/assistant");

  await page.getByRole("button", { name: "ما صافي الربح للفترة؟" }).click();
  const answer = page.locator(".whitespace-pre-wrap").last();
  await expect(answer).toContainText("صافي الربح", { timeout: 30_000 });
  await expect(answer).toContainText("ر.س");
  await expect(answer).toContainText("المصدر");
  await expect(page.getByText("حساب محلي").first()).toBeVisible();
});

test("المساعد يوضح القيود المكررة دون ادعاء حذف", async ({ page }) => {
  await login(page);
  await page.goto("/assistant");
  await page.getByRole("button", { name: "هل توجد قيود مكررة؟" }).click();
  const answer = page.locator(".whitespace-pre-wrap").last();
  await expect(answer).toContainText("لا يتم حذف", { timeout: 30_000 });
});
