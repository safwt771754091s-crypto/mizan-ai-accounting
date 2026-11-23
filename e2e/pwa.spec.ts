import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const BANNER = '[aria-labelledby="rakaz-install-title"]';

async function dispatchInstallPrompt(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.installPromptReady === "1", null, { timeout: 20000 });
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string; platform: string }>;
    };
    event.prompt = async () => undefined;
    event.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" });
    window.dispatchEvent(event);
  });
}

/** يعدّل نسخة الكاش في sw.js مؤقتاً لمحاكاة نشر إصدار جديد، ثم يعيد الملف كما كان. */
async function withNewServiceWorkerVersion<T>(run: () => Promise<T>): Promise<T> {
  const file = path.join(process.cwd(), "public", "sw.js");
  const original = readFileSync(file, "utf8");
  writeFileSync(file, original.replace(/const CACHE_VERSION = "[^"]+";/, 'const CACHE_VERSION = "rakaz-e2e-update";'));
  try {
    // لا نُعيد الملف قبل انتهاء المهمة فعلياً، وإلا قرأ المتصفح النسخة القديمة.
    return await run();
  } finally {
    writeFileSync(file, original);
  }
}

test.describe("PWA — التثبيت والتحديث وعدم الاتصال", () => {
  test("manifest صالح وكل أيقوناته متاحة", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest.short_name).toBe("ركاز");
    expect(manifest.lang).toBe("ar");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/dashboard");

    for (const icon of manifest.icons as Array<{ src: string; sizes: string }>) {
      const iconResponse = await request.get(icon.src);
      expect(iconResponse.status(), `الأيقونة ${icon.src}`).toBe(200);
      expect(iconResponse.headers()["content-type"]).toContain("image/png");
    }
  });

  test("الصفحة الرئيسية تربط manifest وأيقونة آبل", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest/);
    expect(await page.locator('link[rel="apple-touch-icon"]').count()).toBeGreaterThan(0);
  });

  test("service worker يُسجَّل ويتحكم بالصفحة بعد إعادة التحميل", async ({ page }) => {
    await page.goto("/");
    const registration = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { scope: reg.scope, active: Boolean(reg.active) };
    });
    expect(registration.active).toBe(true);
    expect(registration.scope).toContain("/");

    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15000 });
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  });

  test("لا تظهر دعوة التثبيت إذا لم يكن التثبيت الآلي متاحاً", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(9500);
    await expect(page.locator(BANNER)).toHaveCount(0);
    await expect(page.getByTestId("install-app-button")).toHaveCount(0);
  });

  test("دعوة التثبيت تظهر ثم تُخفى بعد الرفض ولا تعود في نفس الجلسة", async ({ page }) => {
    await page.goto("/");
    await dispatchInstallPrompt(page);
    const banner = page.locator(BANNER);
    await expect(banner).toBeVisible({ timeout: 20000 });
    await expect(banner).toContainText("ثبّت ركاز على هاتفك");
    await expect(banner).toContainText("احصل على وصول سريع إلى ركاز");

    await banner.getByRole("button", { name: "ليس الآن" }).click();
    await expect(banner).toHaveCount(0);

    const stored = await page.evaluate(() => ({
      dismissCount: localStorage.getItem("rakaz.install.dismissCount"),
      snoozeUntil: Number(localStorage.getItem("rakaz.install.snoozeUntil")),
      shownInSession: sessionStorage.getItem("rakaz.install.shownInSession"),
    }));
    expect(stored.dismissCount).toBe("1");
    expect(stored.snoozeUntil).toBeGreaterThan(Date.now());
    expect(stored.shownInSession).toBe("1");

    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await dispatchInstallPrompt(page);
    await page.waitForTimeout(9500);
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test("لا يُخزَّن أي HTML لصفحات البيانات المالية", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "demo@rakaz.ai");
    await page.fill("#password", "Demo1234!");
    await Promise.all([page.waitForURL(/dashboard/), page.click("button[type=submit]")]);

    for (const route of ["/statements", "/trial-balance", "/reports", "/ledger"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
    }

    const cachedPaths = await page.evaluate(async () => {
      const paths: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          paths.push(new URL(request.url).pathname);
        }
      }
      return paths;
    });

    const sensitive = ["/statements", "/trial-balance", "/reports", "/ledger", "/dashboard", "/api/"];
    expect(cachedPaths.filter((path) => sensitive.some((prefix) => path.startsWith(prefix)))).toEqual([]);
  });

  test("صفحة عدم الاتصال تظهر بدل الصفحة المحاسبية عند انقطاع الشبكة", async ({ page, context }) => {
    await page.goto("/");
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15000 });

    await context.setOffline(true);
    await page.goto("/statements").catch(() => undefined);
    await expect(page.getByRole("heading", { name: "لا يوجد اتصال بالإنترنت حالياً" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("لا يمكن تنفيذ العمليات المحاسبية حتى يعود الاتصال")).toBeVisible();
    await context.setOffline(false);
  });

  test("دخول المستخدم يعمل مع تفعيل الـ Service Worker", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "demo@rakaz.ai");
    await page.fill("#password", "Demo1234!");
    await Promise.all([page.waitForURL(/dashboard/), page.click("button[type=submit]")]);
    await expect(page.locator("body")).toContainText("لوحة التحكم");
  });

  test("يُكتشف الإصدار الجديد ويظهر إشعار التحديث ثم يُؤجَّل", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 20000 });

    await withNewServiceWorkerVersion(async () => {
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      });
      const banner = page.getByText("يتوفر إصدار جديد من ركاز");
      await expect(banner).toBeVisible({ timeout: 30000 });
      await page.getByRole("button", { name: "تأجيل التحديث" }).click();
      await expect(banner).toHaveCount(0);
      expect(await page.evaluate(() => sessionStorage.getItem("rakaz.sw.updateSnoozed"))).toBe("1");
    });
  });

  test("زر «تحديث الآن» يفعّل النسخة الجديدة ويعيد التحميل مرة واحدة", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 20000 });

    await withNewServiceWorkerVersion(async () => {
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      });
      await expect(page.getByText("يتوفر إصدار جديد من ركاز")).toBeVisible({ timeout: 30000 });
      await page.getByRole("button", { name: "تحديث الآن" }).click();
      await page.waitForTimeout(5000);

      const state = await page.evaluate(() => ({
        reloadedAt: sessionStorage.getItem("rakaz.sw.lastReloadAt"),
        controlled: Boolean(navigator.serviceWorker.controller),
        banner: Boolean(document.querySelector('[role="status"]')),
      }));
      expect(state.reloadedAt).not.toBeNull();
      expect(state.controlled).toBe(true);
    });
  });
});
