import { describe, expect, it } from "vitest";
import { isNavigationError } from "@/lib/utils/navigation-error";

describe("isNavigationError", () => {
  it("يعيد true لخطأ redirect بصيغة digest في Next 16", () => {
    const error = Object.assign(new Error(""), { digest: "NEXT_REDIRECT;push;/companies/1;307" });
    expect(isNavigationError(error)).toBe(true);
  });

  it("يعيد true عندما تكون العلامة في message", () => {
    expect(isNavigationError(new Error("NEXT_REDIRECT"))).toBe(true);
  });

  it("يعيد true لـ notFound", () => {
    expect(isNavigationError(Object.assign(new Error(""), { digest: "NEXT_NOT_FOUND" }))).toBe(true);
  });

  it("يعيد false لأخطاء الأعمال العادية", () => {
    expect(isNavigationError(new Error("تعذر إنشاء الشركة."))).toBe(false);
    expect(isNavigationError(null)).toBe(false);
    expect(isNavigationError("NEXT_REDIRECT")).toBe(false);
  });
});
