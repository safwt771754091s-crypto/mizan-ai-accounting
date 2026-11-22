import { describe, expect, it } from "vitest";
import {
  buildBalanceSheet,
  buildCashFlowStatement,
  buildEquityStatement,
  buildIncomeStatement,
} from "@/lib/accounting/statements";
import { testLedger } from "./fixtures";

const range = { from: "2025-01-01", to: "2025-12-31" };

describe("قائمة الدخل", () => {
  const income = buildIncomeStatement(testLedger, range);

  it("يحسب الإيرادات ومجمل الربح", () => {
    expect(income.revenue).toBe(120000);
    expect(income.netRevenue).toBe(120000);
    expect(income.costOfSales).toBe(72000);
    expect(income.grossProfit).toBe(48000);
  });

  it("يحسب المصروفات التشغيلية والربح التشغيلي", () => {
    expect(income.adminExpenses).toBe(42000);
    expect(income.depreciation).toBe(10000);
    expect(income.operatingExpenses).toBe(52000);
    expect(income.operatingProfit).toBe(-4000);
  });

  it("يحسب صافي الربح بعد المالية والضريبة", () => {
    expect(income.financeExpenses).toBe(5000);
    expect(income.profitBeforeTax).toBe(-9000);
    expect(income.taxExpense).toBe(4000);
    expect(income.netProfit).toBe(-13000);
  });

  it("يبني سطور القائمة بترتيب محاسبي صحيح", () => {
    const keys = income.lines.map((l) => l.key);
    expect(keys.indexOf("net_revenue")).toBeLessThan(keys.indexOf("gross_profit"));
    expect(keys.indexOf("gross_profit")).toBeLessThan(keys.indexOf("operating_profit"));
    expect(keys.indexOf("operating_profit")).toBeLessThan(keys.indexOf("net_profit"));
  });

  it("ينبه عند غياب تكلفة المبيعات", () => {
    const withoutCogs = {
      ...testLedger,
      entries: testLedger.entries.filter((e) => e.id !== "e2"),
    };
    const result = buildIncomeStatement(withoutCogs, range);
    expect(result.warnings.some((w) => w.includes("تكلفة مبيعات"))).toBe(true);
  });
});

describe("قائمة المركز المالي", () => {
  const balance = buildBalanceSheet(testLedger, { ...range, periodStart: "2025-01-01" });

  it("يحسب الأصول المتداولة", () => {
    expect(balance.cash).toBe(93000);
    expect(balance.receivables).toBe(30000);
    expect(balance.inventory).toBe(118000);
    expect(balance.totalCurrentAssets).toBe(241000);
  });

  it("يحسب صافي الأصول الثابتة", () => {
    expect(balance.fixedAssets).toBe(200000);
    expect(balance.accumulatedDepreciation).toBe(-50000);
    expect(balance.netFixedAssets).toBe(150000);
    expect(balance.totalAssets).toBe(391000);
  });

  it("يحسب الالتزامات وحقوق الملكية", () => {
    expect(balance.payables).toBe(50000);
    expect(balance.taxPayable).toBe(4000);
    expect(balance.totalLiabilities).toBe(54000);
    expect(balance.capital).toBe(250000);
    expect(balance.retainedEarnings).toBe(100000);
    expect(balance.currentPeriodProfit).toBe(-13000);
    expect(balance.totalEquity).toBe(337000);
  });

  it("يحقق معادلة الميزانية: الأصول = الالتزامات + حقوق الملكية", () => {
    expect(balance.balanced).toBe(true);
    expect(balance.difference).toBe(0);
    expect(balance.totalAssets).toBe(balance.totalLiabilitiesAndEquity);
  });

  it("ينبه عند عدم التوازن", () => {
    const broken = {
      ...testLedger,
      entries: [
        ...testLedger.entries,
        {
          id: "broken",
          entryNumber: "X-1",
          date: "2025-06-01",
          description: "قيد ناقص",
          source: "manual",
          status: "posted" as const,
          lines: [
            { accountCode: "1010", debit: 1000, credit: 0 },
            { accountCode: "4010", debit: 0, credit: 900 },
          ],
        },
      ],
    };
    const result = buildBalanceSheet(broken, { ...range, periodStart: "2025-01-01" });
    expect(result.balanced).toBe(false);
    expect(result.difference).toBe(100);
    expect(result.warnings.some((w) => w.includes("غير متوازنة"))).toBe(true);
  });
});

describe("قائمة التدفقات النقدية", () => {
  const cashFlow = buildCashFlowStatement(testLedger, range);

  it("متاحة عند وجود فترة ونقدية", () => {
    expect(cashFlow.available).toBe(true);
    expect(cashFlow.openingCash).toBe(100000);
    expect(cashFlow.closingCash).toBe(93000);
  });

  it("تحقق تسوية التغير في النقدية", () => {
    expect(cashFlow.netChange).toBe(-7000);
    expect(cashFlow.closingCash - cashFlow.openingCash).toBe(cashFlow.netChange);
    expect(cashFlow.warnings.some((w) => w.includes("فرق تسوية"))).toBe(false);
  });

  it("تحسب التدفقات التشغيلية بالطريقة غير المباشرة", () => {
    expect(cashFlow.operating).toBe(-7000);
    expect(cashFlow.investing).toBe(0);
    expect(cashFlow.financing).toBe(0);
  });

  it("تكون غير متاحة دون فترة", () => {
    const result = buildCashFlowStatement(testLedger, { to: "2025-12-31" });
    expect(result.available).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("قائمة التغيرات في حقوق الملكية", () => {
  const equity = buildEquityStatement(testLedger, range);

  it("تحسب رأس المال والأرباح المحتجزة", () => {
    expect(equity.openingCapital).toBe(250000);
    expect(equity.closingCapital).toBe(250000);
    expect(equity.capitalAdditions).toBe(0);
    expect(equity.openingRetained).toBe(100000);
    expect(equity.netProfit).toBe(-13000);
    expect(equity.totalEquity).toBe(337000);
  });
});
