import { expect, test } from "@playwright/test";

test.describe("صفحة الهبوط", () => {
  test("تعرض الأقسام التسويقية الستة والحدود", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "منظومة واحدة للمحاسب والمدير والمراجع" })).toBeVisible();
    for (const title of [
      "تحليل البيانات المالية",
      "إعداد القوائم المالية",
      "اكتشاف الأخطاء المحاسبية",
      "كشف القيود والفواتير المكررة",
      "التحليل المالي والمؤشرات",
      "المساعد المحاسبي الذكي",
    ]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
    await expect(page.getByText("حدود مهمة يجب معرفتها")).toBeVisible();
    await expect(page.getByRole("heading", { name: "قبل أن تبدأ" })).toBeVisible();
  });

  test("توضح أن الأرقام المعروضة تجريبية", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("بيانات تجريبية").first()).toBeVisible();
    await expect(page.getByText(/ليست بيانات عميل حقيقي/)).toBeVisible();
    await expect(page.getByText(/عرض توضيحي — بيانات تجريبية/)).toBeVisible();
  });

  test("تعرض أرقام القوائم المحسوبة والمعادلة المتوازنة", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("965,342.11").first()).toBeVisible();
    await expect(page.getByText("45,542.11").first()).toBeVisible();
    await expect(page.getByText("المعادلة متوازنة").first()).toBeVisible();
  });

  test("لا تسبب تمريراً أفقياً على الهاتف", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
