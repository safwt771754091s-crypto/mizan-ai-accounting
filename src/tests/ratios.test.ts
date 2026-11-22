import { describe, expect, it } from "vitest";
import { buildFinancialAnalysis, buildTrends } from "@/lib/accounting/ratios";
import { testLedger } from "./fixtures";

const analysis = buildFinancialAnalysis(testLedger, { from: "2025-01-01", to: "2025-12-31" });

function ratio(key: string) {
  return analysis.ratios.find((r) => r.key === key);
}

describe("النسب المالية", () => {
  it("يحسب نسبة التداول والسيولة السريعة", () => {
    expect(ratio("current_ratio")?.value).toBeCloseTo(4.46, 2);
    expect(ratio("quick_ratio")?.value).toBeCloseTo(2.28, 2);
    expect(ratio("current_ratio")?.available).toBe(true);
  });

  it("يحسب هوامش الربح", () => {
    expect(ratio("gross_margin")?.value).toBeCloseTo(40, 1);
    expect(ratio("operating_margin")?.value).toBeCloseTo(-3.33, 1);
    expect(ratio("net_margin")?.value).toBeCloseTo(-10.83, 1);
  });

  it("يحسب المديونية والعائد", () => {
    expect(ratio("debt_ratio")?.value).toBeCloseTo(13.81, 1);
    expect(ratio("roa")?.value).toBeCloseTo(-3.32, 1);
    expect(ratio("roe")?.value).toBeCloseTo(-3.86, 1);
  });

  it("لا يعرض نسباً غير قابلة للحساب", () => {
    const withoutInventory = {
      ...testLedger,
      entries: testLedger.entries.filter((e) => e.id !== "e0"),
    };
    const result = buildFinancialAnalysis(withoutInventory, { from: "2025-01-01", to: "2025-12-31" });
    const turnover = result.ratios.find((r) => r.key === "inventory_turnover");
    expect(turnover?.available).toBe(false);
    expect(turnover?.unavailableReason).toBeTruthy();
    expect(result.warnings.some((w) => w.includes("المخزون"))).toBe(true);
  });

  it("يعرض معادلة كل نسبة", () => {
    for (const item of analysis.ratios) {
      expect(item.formula.length).toBeGreaterThan(5);
    }
  });
});

describe("التحليل الزمني", () => {
  it("يبني سلسلة شهرية كاملة", () => {
    expect(analysis.monthly).toHaveLength(12);
    expect(analysis.monthly[0].period).toBe("2025-01");
    const totalRevenue = analysis.monthly.reduce((s, m) => s + m.revenue, 0);
    expect(totalRevenue).toBeCloseTo(120000, 2);
  });

  it("يحسب التغيرات مقارنة بالفترة السابقة", () => {
    expect(analysis.revenueChange).toBeNull();
  });

  it("يحسب اتجاهات النمو", () => {
    const trends = buildTrends(analysis);
    expect(trends).toHaveLength(12);
    expect(trends[0].revenueGrowth).toBeNull();
  });

  it("يفصّل المصروفات حسب الحساب", () => {
    const codes = analysis.expenseBreakdown.map((e) => e.code);
    expect(codes).toContain("5010");
    expect(codes).toContain("6010");
    expect(analysis.expenseBreakdown[0].amount).toBeGreaterThanOrEqual(analysis.expenseBreakdown[1].amount);
  });
});
