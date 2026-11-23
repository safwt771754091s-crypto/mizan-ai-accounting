import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, login } from "./helpers";

test.describe("مركز المقترحات", () => {
  test("المالك يقدّم مقترحاً ثم يفرزه ويظهر في سجل التدقيق", async ({ page }) => {
    const title = `مقترح اختبار ${Date.now().toString().slice(-6)}`;
    await login(page);
    await page.goto("/proposals?company=co-nakheel");
    await expect(page.getByRole("heading", { name: "مركز المقترحات" })).toBeVisible();

    await page.getByPlaceholder("مثال: تصدير قائمة الدخل إلى PDF").fill(title);
    await page
      .getByPlaceholder("اشرح المشكلة، الحل المقترح، والأثر على العمل")
      .fill("نحتاج تقريراً شهرياً يقارن الإيرادات بالمصروفات لكل فرع مع ملاحظات المراجعة.");
    await page.getByRole("button", { name: "تقديم المقترح" }).click();

    const card = page.locator("div").filter({ hasText: title }).first();
    await expect(page.getByText(title).first()).toBeVisible();
    await expect(page.getByText("جديد").first()).toBeVisible();

    await page.getByRole("button", { name: "اعتماد" }).first().click();
    await expect(page.getByRole("button", { name: "تم التنفيذ" }).first()).toBeVisible();
    await expect(page.getByText("معتمد").first()).toBeVisible();
    expect(card).toBeTruthy();

    await page.goto("/audit?company=co-nakheel");
    await expect(page.getByText("تقديم مقترح").first()).toBeVisible();
    await expect(page.getByText("تغيير حالة مقترح").first()).toBeVisible();
  });

  test("الإرسال إلى GitHub يظهر معطّلاً بوضوح عند غياب التوكن", async ({ page }) => {
    await login(page);
    await page.goto("/proposals?company=co-nakheel");
    await expect(page.getByText("الإرسال إلى GitHub غير مُهيّأ")).toBeVisible();
    await expect(page.getByRole("button", { name: "إرسال إلى GitHub" })).toHaveCount(0);
  });

  test("المشاهد يرى المقترحات دون نموذج تقديم أو أزرار فرز", async ({ page }) => {
    await login(page, "viewer@rakaz.ai", DEMO_PASSWORD);
    await page.goto("/proposals?company=co-nakheel");
    await expect(page.getByRole("heading", { name: "مركز المقترحات" })).toBeVisible();
    await expect(page.getByRole("button", { name: "تقديم المقترح" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "اعتماد" })).toHaveCount(0);
  });
});
