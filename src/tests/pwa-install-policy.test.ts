import { describe, expect, it } from "vitest";
import { INSTALL_POLICY, isSnoozed, shouldShowInstallBanner, snoozeAfterDismiss, type InstallContext } from "@/lib/pwa/install-policy";
import { isIosDevice, isStandaloneMode } from "@/lib/pwa/environment";

const base: InstallContext = {
  installed: false,
  standalone: false,
  promptAvailable: true,
  shownThisSession: false,
  snoozed: false,
  dismissCount: 0,
};

describe("سياسة دعوة التثبيت", () => {
  it("تعرض الدعوة عندما تتوفر كل الشروط", () => {
    expect(shouldShowInstallBanner(base)).toBe(true);
  });

  it("لا تعرض عند تثبيت التطبيق", () => {
    expect(shouldShowInstallBanner({ ...base, installed: true })).toBe(false);
  });

  it("لا تعرض داخل وضع standalone", () => {
    expect(shouldShowInstallBanner({ ...base, standalone: true })).toBe(false);
  });

  it("لا تعرض إذا لم يكن التثبيت الآلي متاحاً", () => {
    expect(shouldShowInstallBanner({ ...base, promptAvailable: false })).toBe(false);
  });

  it("لا تعرض مرتين في الجلسة نفسها", () => {
    expect(shouldShowInstallBanner({ ...base, shownThisSession: true })).toBe(false);
  });

  it("لا تعرض خلال مدة التأجيل", () => {
    expect(shouldShowInstallBanner({ ...base, snoozed: true })).toBe(false);
  });

  it("تعرض بعد انتهاء مدة التأجيل", () => {
    expect(shouldShowInstallBanner({ ...base, snoozed: false })).toBe(true);
    expect(isSnoozed(1_700_000_100_000, 1_700_000_060_000)).toBe(true);
    expect(isSnoozed(1_700_000_100_000, 1_700_000_100_001)).toBe(false);
    expect(isSnoozed(null, 1)).toBe(false);
  });

  it("تتوقف نهائياً بعد بلوغ حد الرفض", () => {
    expect(shouldShowInstallBanner({ ...base, dismissCount: INSTALL_POLICY.maxDismissals })).toBe(false);
  });

  it("تأجيل الرفض يتدرج ثم يتوقف", () => {
    expect(snoozeAfterDismiss(1)).toBe(14 * 24 * 60 * 60 * 1000);
    expect(snoozeAfterDismiss(2)).toBe(45 * 24 * 60 * 60 * 1000);
    expect(snoozeAfterDismiss(3)).toBeNull();
  });
});

describe("كشف بيئة التثبيت", () => {
  it("يعرف وضع standalone من matchMedia أو navigator.standalone", () => {
    expect(isStandaloneMode(true, false)).toBe(true);
    expect(isStandaloneMode(false, true)).toBe(true);
    expect(isStandaloneMode(false, false)).toBe(false);
  });

  it("يعرف أجهزة iOS بما فيها iPadOS الذي يعلن Macintosh", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel")).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Linux; Android 14; Pixel 7)")).toBe(false);
  });
});
