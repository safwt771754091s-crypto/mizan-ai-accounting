import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { DEFAULT_ANDROID_PACKAGE_ID } from "@/lib/android/assetlinks";
import { APP_VERSION } from "@/lib/pwa/version";

const root = process.cwd();
const twa = JSON.parse(readFileSync(path.join(root, "android", "twa-manifest.json"), "utf8"));
const web = manifest();
const gitignore = readFileSync(path.join(root, ".gitignore"), "utf8");

function localPath(url: string): string {
  return path.join("public", new URL(url).pathname.replace(/^\//, ""));
}

describe("إعداد TWA متوافق مع الويب", () => {
  it("يستخدم نفس معرّف الحزمة المعتمد في assetlinks", () => {
    expect(twa.packageId).toBe(DEFAULT_ANDROID_PACKAGE_ID);
  });

  it("يستهدف دومين الإنتاج ونفس الـ manifest", () => {
    expect(twa.host).toBe("mizan-ai-accounting.vercel.app");
    expect(twa.webManifestUrl).toBe(`https://${twa.host}/manifest.webmanifest`);
  });

  it("يطابق ألوان الهوية وأسلوب العرض في الـ manifest", () => {
    expect(twa.themeColor).toBe(web.theme_color);
    expect(twa.backgroundColor).toBe(web.background_color);
    expect(twa.display).toBe(web.display);
    expect(twa.startUrl).toBe(web.start_url);
  });

  it("يشير إلى أيقونات موجودة فعلياً", () => {
    for (const url of [twa.iconUrl, twa.maskableIconUrl]) {
      expect(existsSync(path.join(root, localPath(url)))).toBe(true);
    }
    for (const shortcut of twa.shortcuts) {
      expect(web.shortcuts?.some((item) => item.url === shortcut.url)).toBe(true);
    }
  });

  it("يحمل إصدار التطبيق الحالي ورقم بناء صحيحاً", () => {
    expect(twa.appVersionName).toBe(APP_VERSION);
    expect(Number.isInteger(twa.appVersionCode)).toBe(true);
    expect(twa.appVersionCode).toBeGreaterThan(0);
  });

  it("لا يُسمح برفع مفتاح التوقيع إلى المستودع", () => {
    expect(twa.signingKey.path).toContain("android.keystore");
    expect(gitignore).toContain("*.keystore");
    expect(gitignore).toContain("*.jks");
  });
});
