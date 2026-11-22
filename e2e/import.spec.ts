import { expect, test } from "@playwright/test";
import { login, uniqueEntryNumber } from "./helpers";

test("رفع قيود يومية CSV واستيرادها ثم ظهورها في السجل", async ({ page }) => {
  await login(page);
  await page.goto("/upload");

  const entry = uniqueEntryNumber();
  const csv = [
    "رقم القيد,التاريخ,البيان,رقم الحساب,مدين,دائن",
    `${entry},2025-06-15,قيد اختبار آلي,1010,1000,0`,
    `${entry},2025-06-15,قيد اختبار آلي,4010,0,1000`,
  ].join("\n");

  const input = page.locator('input[type="file"]');
  await expect(input).toBeEnabled();
  await input.setInputFiles({
    name: `e2e-${entry}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });

  await expect(page.getByText("2. ورقة العمل والأعمدة")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/ثقة الاكتشاف/)).toBeVisible();
  await expect(page.getByText(/أخطاء تمنع الاستيراد/)).toHaveCount(0);

  await page.getByRole("button", { name: "تأكيد الاستيراد" }).click();
  await expect(page.getByText(/تم استيراد|لم تُضف بيانات مكررة/).first()).toBeVisible({ timeout: 30_000 });

  await page.goto("/imports");
  await expect(page.getByText(`e2e-${entry}.csv`).first()).toBeVisible();
});

test("يرفض الملفات غير المدعومة", async ({ page }) => {
  await login(page);
  await page.goto("/upload");
  const input = page.locator('input[type="file"]');
  await expect(input).toBeEnabled();
  await input.setInputFiles({
    name: "malware.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("MZ fake binary", "utf8"),
  });
  await expect(page.getByText(/امتداد الملف غير مدعوم/)).toBeVisible();
});
