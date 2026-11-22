import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, login } from "./helpers";

const VIEWER = "viewer@rakaz.ai";

test.describe("الصلاحيات على الخادم", () => {
  test("المشاهد لا يستطيع فتح صفحة المستخدمين", async ({ page }) => {
    await login(page, VIEWER, DEMO_PASSWORD);
    await page.goto("/users?company=co-nakheel");
    await expect(page.getByText("لا تملك صلاحية الوصول")).toBeVisible();
    await expect(page.getByRole("heading", { name: "أعضاء الشركة" })).toHaveCount(0);
  });

  test("المشاهد لا يستطيع فتح صفحة رفع الملفات", async ({ page }) => {
    await login(page, VIEWER, DEMO_PASSWORD);
    await page.goto("/upload?company=co-nakheel");
    await expect(page.getByText("لا تملك صلاحية الوصول")).toBeVisible();
    await expect(page.getByText("الصيغ المدعومة")).toHaveCount(0);
  });

  test("عناصر التنقل غير المسموحة مخفية عن المشاهد", async ({ page }) => {
    await login(page, VIEWER, DEMO_PASSWORD);
    await expect(page.getByRole("link", { name: "المستخدمون والصلاحيات" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "رفع الملفات" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "ميزان المراجعة" })).toBeVisible();
  });

  test("المالك يرى إدارة الأدوار المخصصة والمدير لا يراها", async ({ page }) => {
    await login(page);
    await page.goto("/users?company=co-nakheel");
    await expect(page.getByRole("heading", { name: "الأدوار المخصصة" })).toBeVisible();

    await page.goto("/users?company=co-rakaz");
    await expect(page.getByRole("heading", { name: "أعضاء الشركة" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "الأدوار المخصصة" })).toHaveCount(0);
  });

  test("تعديل معرّف الشركة في الرابط لا يمنح وصولاً لشركة أخرى", async ({ page }) => {
    await login(page, VIEWER, DEMO_PASSWORD);
    await page.goto("/dashboard?company=co-ufuq");
    await expect(page.getByRole("heading", { name: "لوحة التحكم" })).toBeVisible();
    await expect(page.getByRole("option", { name: "شركة النخيل للتجارة" })).toHaveCount(1);
    await expect(page.getByRole("option", { name: "مؤسسة الأفق للمقاولات" })).toHaveCount(0);
  });

  test("مالك الشركة ينشئ دوراً مخصصاً ويظهر في القائمة", async ({ page }) => {
    await login(page);
    await page.goto("/users?company=co-nakheel");
    const name = `دور اختبار ${Date.now().toString().slice(-6)}`;
    await page.getByLabel("اسم الدور").fill(name);
    await page.getByRole("checkbox", { name: "عرض التقارير" }).check();
    await page.getByRole("button", { name: "إنشاء الدور" }).click();
    await expect(page.getByRole("paragraph").filter({ hasText: name })).toBeVisible();
  });
});
