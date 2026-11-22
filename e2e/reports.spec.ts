import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("التقرير الشامل يعرض الأقسام ويصدّر Excel", async ({ page }) => {
  await login(page);
  await page.goto("/reports");

  await expect(page.getByText("1. الملخص التنفيذي")).toBeVisible();
  await expect(page.getByText("3. قائمة الدخل")).toBeVisible();
  await expect(page.getByText("4. قائمة المركز المالي")).toBeVisible();
  await expect(page.getByText("16. القيود على التحليل وإخلاء المسؤولية")).toBeVisible();
  await expect(page.getByText(/تحليل مساعد/).first()).toBeVisible();

  const href = await page.getByRole("link", { name: "تصدير Excel" }).first().getAttribute("href");
  expect(href).toContain("/api/reports/export");
  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("spreadsheetml");
  const body = await response.body();
  expect(body.byteLength).toBeGreaterThan(5000);
});

test("ميزان المراجعة يظهر متوازناً", async ({ page }) => {
  await login(page);
  await page.goto("/trial-balance");
  await expect(page.getByText("متوازن").first()).toBeVisible();
});
