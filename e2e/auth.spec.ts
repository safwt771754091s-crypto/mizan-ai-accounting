import { expect, test } from "@playwright/test";
import { DEMO_EMAIL, DEMO_PASSWORD, login } from "./helpers";

test.describe("المصادقة", () => {
  test("تعرض خطأً مع كلمة مرور غير صحيحة", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("البريد الإلكتروني").fill(DEMO_EMAIL);
    await page.getByLabel("كلمة المرور").fill("wrong-password");
    await page.getByRole("button", { name: "دخول", exact: true }).click();
    await expect(page.getByText(/بيانات الدخول غير صحيحة|تعذر تسجيل الدخول/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("تسجيل الدخول يفتح لوحة التحكم", async ({ page }) => {
    await login(page);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByText("صافي الربح").first()).toBeVisible();
  });

  test("تحمي الصفحات الداخلية من الزوار", async ({ page }) => {
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/login/);
  });

  test("المشاهد لا يرى إلا الشركات المسموح بها", async ({ page }) => {
    await login(page, "viewer@rakaz.ai", DEMO_PASSWORD);
    await page.goto("/companies");
    await expect(page.getByRole("heading", { name: /شركة النخيل للتجارة/ }).first()).toBeVisible();
    await expect(page.getByText("مؤسسة الأفق للمقاولات")).toHaveCount(0);
  });
});
