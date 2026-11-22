import { describe, expect, it } from "vitest";
import { formatMoney, normalizeDigits, round2, toMoney } from "@/lib/accounting/money";

describe("toMoney", () => {
  it("يحوّل الأرقام العربية والإنجليزية", () => {
    expect(toMoney("١٢٣٤.٥٦").toNumber()).toBe(1234.56);
    expect(toMoney("۱۲۳۴").toNumber()).toBe(1234);
    expect(toMoney(1234.56).toNumber()).toBe(1234.56);
  });

  it("يتعامل مع الفواصل الألفية والعشرية", () => {
    expect(toMoney("1,234,567.89").toNumber()).toBe(1234567.89);
    expect(toMoney("1.234.567,89").toNumber()).toBe(1234567.89);
    expect(toMoney("1,234").toNumber()).toBe(1234);
    expect(toMoney("12,5").toNumber()).toBe(12.5);
  });

  it("يتعامل مع الأقواس والسالب ورمز العملة", () => {
    expect(toMoney("(1,500.00)").toNumber()).toBe(-1500);
    expect(toMoney("-1,500.00").toNumber()).toBe(-1500);
    expect(toMoney("1,500.00-").toNumber()).toBe(-1500);
    expect(toMoney("1,200 ر.س").toNumber()).toBe(1200);
    expect(toMoney("$ 2,400.50").toNumber()).toBe(2400.5);
  });

  it("يعيد صفراً للقيم غير الصالحة", () => {
    expect(toMoney("").toNumber()).toBe(0);
    expect(toMoney(null).toNumber()).toBe(0);
    expect(toMoney("abc").toNumber()).toBe(0);
    expect(toMoney(Number.NaN).toNumber()).toBe(0);
  });

  it("يحافظ على الدقة المالية دون أخطاء floating point", () => {
    expect(toMoney("0.1").plus(toMoney("0.2")).toNumber()).toBe(0.3);
    expect(toMoney("0.1").plus(toMoney("0.2")).equals(0.3)).toBe(true);
    expect(round2("2.675").toNumber()).toBe(2.68);
  });
});

describe("formatMoney", () => {
  it("يعرض المبلغ مع رمز العملة العربية", () => {
    expect(formatMoney("1234.5", "SAR")).toBe("1,234.50 ر.س");
    expect(formatMoney("-500", "AED")).toBe("-500.00 د.إ");
  });
});

describe("normalizeDigits", () => {
  it("يحوّل الأرقام العربية", () => {
    expect(normalizeDigits("١٢٣٤٥٦٧٨٩٠")).toBe("1234567890");
  });
});
