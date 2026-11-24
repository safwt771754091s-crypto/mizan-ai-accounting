import { expect, test } from "@playwright/test";

test.describe("Android — Digital Asset Links", () => {
  test("الملف متاح علناً بصيغة JSON صالحة", async ({ request }) => {
    const response = await request.get("/.well-known/assetlinks.json");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("المسار لا يُعيد التوجيه إلى تسجيل الدخول", async ({ page }) => {
    const response = await page.goto("/.well-known/assetlinks.json");
    expect(response?.status()).toBe(200);
    expect(page.url()).toContain("/.well-known/assetlinks.json");
    expect(page.url()).not.toContain("/login");
  });
});
