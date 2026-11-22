import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const ROUTES: Array<{ path: string; heading: string }> = [
  { path: "/dashboard", heading: "لوحة التحكم" },
  { path: "/companies", heading: "شركاتك" },
  { path: "/upload", heading: "رفع واستيراد الملفات المحاسبية" },
  { path: "/imports", heading: "بيانات المحاسبة المستوردة" },
  { path: "/accounts", heading: "دليل الحسابات" },
  { path: "/trial-balance", heading: "ميزان المراجعة" },
  { path: "/ledger", heading: "دفتر الأستاذ" },
  { path: "/statements", heading: "القوائم المالية" },
  { path: "/analysis", heading: "التحليل المالي" },
  { path: "/findings", heading: "اكتشاف الأخطاء والملاحظات" },
  { path: "/anomalies", heading: "العمليات غير المعتادة وتحليل المصروفات" },
  { path: "/duplicates", heading: "القيود والفواتير المكررة المحتملة" },
  { path: "/reports", heading: "التقرير المالي الشامل" },
  { path: "/assistant", heading: "المساعد المحاسبي الذكي" },
  { path: "/settings", heading: "الإعدادات" },
  { path: "/users", heading: "المستخدمون والصلاحيات" },
];

test("كل صفحات التطبيق تعمل بعد تسجيل الدخول", async ({ page }) => {
  await login(page);
  for (const route of ROUTES) {
    await page.goto(route.path);
    await expect(page.locator("h1").first(), route.path).toContainText(route.heading);
    await expect(page.getByText(/Application error|Internal Server Error/)).toHaveCount(0);
  }
});

test("تبديل الشركة يغيّر بيانات الصفحة", async ({ page }) => {
  await login(page);
  await page.goto("/statements?company=co-ufuq");
  await expect(page.locator("h1").first()).toContainText("القوائم المالية");
  await expect(page.getByRole("banner").getByText("مؤسسة الأفق للمقاولات").first()).toBeVisible();
});
