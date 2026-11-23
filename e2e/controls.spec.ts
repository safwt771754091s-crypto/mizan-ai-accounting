import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, login } from "./helpers";

test.describe("الرقابة الداخلية والفترات", () => {
  test("إغلاق الفترة يُسجّل في سجل التدقيق، وإعادة الفتح تُرجعها مفتوحة", async ({ page }) => {
    await login(page);
    await page.goto("/periods?company=co-nakheel");
    await expect(page.getByRole("heading", { name: "الفترات المالية" })).toBeVisible();

    const closeButton = page.getByRole("button", { name: "إغلاق الفترة" }).first();
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    const reopenButton = page.getByRole("button", { name: "إعادة الفتح" }).first();
    await expect(reopenButton).toBeVisible();
    await expect(page.getByText("مغلقة").first()).toBeVisible();

    await page.goto("/audit?company=co-nakheel");
    await expect(page.getByRole("heading", { name: "سجل التدقيق" })).toBeVisible();
    await expect(page.getByText("إغلاق فترة مالية").first()).toBeVisible();

    await page.goto("/periods?company=co-nakheel");
    await page.getByPlaceholder("سبب إعادة الفتح").first().fill("تصحيح قيد بعد المراجعة");
    await page.getByRole("button", { name: "إعادة الفتح" }).first().click();
    await expect(page.getByRole("button", { name: "إغلاق الفترة" }).first()).toBeVisible();

    await page.goto("/audit?company=co-nakheel");
    await expect(page.getByText("إعادة فتح فترة مالية").first()).toBeVisible();
  });

  test("المدير يغلق الفترة لكنه لا يملك صلاحية إعادة فتحها", async ({ page }) => {
    await login(page);
    await page.goto("/periods?company=co-rakaz");
    await expect(page.getByRole("heading", { name: "الفترات المالية" })).toBeVisible();
    await expect(page.getByRole("button", { name: "إغلاق الفترة" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "إعادة الفتح" })).toHaveCount(0);
  });

  test("المشاهد لا يفتح سجل التدقيق", async ({ page }) => {
    await login(page, "viewer@rakaz.ai", DEMO_PASSWORD);
    await page.goto("/audit?company=co-nakheel");
    await expect(page.getByText("لا تملك صلاحية الوصول")).toBeVisible();
    await expect(page.getByText("المنفّذ")).toHaveCount(0);
  });

  test("صفحة مسارات الاعتماد تعرض قائمة العمل دون أزرار اعتماد للمشاهد", async ({ page }) => {
    await login(page, "viewer@rakaz.ai", DEMO_PASSWORD);
    await page.goto("/approvals?company=co-nakheel");
    await expect(page.getByRole("heading", { name: "مسارات الاعتماد" })).toBeVisible();
    await expect(page.getByRole("button", { name: "اعتماد" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ترحيل" })).toHaveCount(0);
  });
});

