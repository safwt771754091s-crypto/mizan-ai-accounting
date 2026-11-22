import { describe, expect, it } from "vitest";
import { buildDemoCompanies, buildDemoData } from "@/lib/data/demo-data";
import { entryTotals } from "@/lib/accounting/engine";
import { buildBalanceSheet, buildIncomeStatement } from "@/lib/accounting/statements";
import { buildTrialBalance } from "@/lib/accounting/engine";
import { detectAuditFindings } from "@/lib/accounting/findings";
import { detectDuplicates } from "@/lib/accounting/duplicates";
import { detectAnomalies } from "@/lib/accounting/anomalies";
import type { Ledger } from "@/lib/accounting/types";

const companies = buildDemoCompanies();
const data = buildDemoData();

function ledgerFor(companyId: string): Ledger {
  const company = companies.find((c) => c.id === companyId)!;
  return {
    accounts: data[companyId].accounts,
    entries: data[companyId].entries,
    periods: data[companyId].periods,
    currency: company.currency,
  };
}

describe("بيانات العرض التجريبية", () => {
  it("تحتوي على ثلاث شركات", () => {
    expect(companies).toHaveLength(3);
    expect(new Set(companies.map((c) => c.currency))).toEqual(new Set(["SAR", "AED"]));
  });

  it("كل قيد في الشركات السليمة متوازن", () => {
    for (const companyId of ["co-nakheel", "co-ufuq"]) {
      for (const entry of data[companyId].entries) {
        expect(entryTotals(entry).balanced, `${companyId} ${entry.entryNumber}`).toBe(true);
      }
    }
  });

  it("ميزان المراجعة متوازن في شركة النخيل", () => {
    const trial = buildTrialBalance(ledgerFor("co-nakheel"), { from: "2025-01-01", to: "2025-12-31" });
    expect(trial.balanced).toBe(true);
    expect(trial.difference).toBe(0);
  });

  it("قائمة المركز المالي متوازنة", () => {
    for (const companyId of ["co-nakheel", "co-ufuq"]) {
      const balance = buildBalanceSheet(ledgerFor(companyId), {
        from: "2025-01-01",
        to: "2025-12-31",
        periodStart: "2025-01-01",
      });
      expect(balance.balanced, companyId).toBe(true);
      expect(balance.difference, companyId).toBe(0);
    }
  });

  it("لا تنتج نقدية أو بنكاً سالباً في الشركات السليمة", () => {
    for (const companyId of ["co-nakheel", "co-ufuq"]) {
      const balance = buildBalanceSheet(ledgerFor(companyId), {
        from: "2025-01-01",
        to: "2025-12-31",
        periodStart: "2025-01-01",
      });
      expect(balance.cash, companyId).toBeGreaterThanOrEqual(0);
      expect(balance.bank, companyId).toBeGreaterThanOrEqual(0);
    }
  });

  it("تحقق ربحية واقعية لشركة النخيل", () => {
    const income = buildIncomeStatement(ledgerFor("co-nakheel"), { from: "2025-01-01", to: "2025-12-31" });
    expect(income.netRevenue).toBeGreaterThan(1_000_000);
    expect(income.grossProfit).toBeGreaterThan(0);
    expect(income.netProfit).toBeGreaterThan(0);
  });

  it("تحتوي شركة متجر ركاز على أخطاء مقصودة للفحص", () => {
    const findings = detectAuditFindings(ledgerFor("co-rakaz"), { from: "2025-01-01", to: "2025-12-31" });
    expect(findings.some((f) => f.code === "UNBALANCED_ENTRY")).toBe(true);
    expect(findings.some((f) => f.code === "UNKNOWN_ACCOUNT")).toBe(true);
  });

  it("تكتشف فاتورة مكررة في بيانات النخيل", () => {
    const duplicates = detectDuplicates(ledgerFor("co-nakheel"), { from: "2025-01-01", to: "2025-12-31" });
    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates.some((g) => g.reasons.some((r) => r.includes("متطابق")))).toBe(true);
  });

  it("تكتشف ارتفاعاً غير معتاد في مصروف التسويق", () => {
    const anomalies = detectAnomalies(ledgerFor("co-nakheel"), { from: "2025-01-01", to: "2025-12-31" });
    expect(anomalies.some((a) => a.accountCode === "6040")).toBe(true);
  });

  it("تغطي البيانات 12 شهراً", () => {
    const months = new Set(
      data["co-nakheel"].entries
        .filter((e) => e.date.startsWith("2025"))
        .map((e) => e.date.slice(0, 7)),
    );
    expect(months.size).toBe(12);
  });

  it("تطابق عملة كل قيد مع عملة شركته", () => {
    for (const company of companies) {
      const currencies = new Set(data[company.id].entries.map((entry) => entry.currency));
      expect([...currencies]).toEqual([company.currency]);
    }
  });

  it("تُعد قوائم متوازنة للشركات السليمة في البيانات التجريبية", () => {
    for (const id of ["co-nakheel", "co-ufuq"]) {
      const company = companies.find((item) => item.id === id)!;
      const balance = buildBalanceSheet(ledgerFor(id), {
        from: company.fiscalYearStart,
        to: company.fiscalYearEnd,
        periodStart: company.fiscalYearStart,
      });
      expect(balance.balanced).toBe(true);
      expect(balance.difference).toBe(0);
    }
  });
});
