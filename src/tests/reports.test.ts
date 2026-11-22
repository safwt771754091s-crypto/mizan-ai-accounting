import { describe, expect, it } from "vitest";
import { buildDemoCompanies, buildDemoData } from "@/lib/data/demo-data";
import { buildReportData } from "@/lib/reports/build";
import type { Ledger } from "@/lib/accounting/types";

const companies = buildDemoCompanies();
const data = buildDemoData();
const company = companies[0];
const companyData = data[company.id];
const ledger: Ledger = {
  accounts: companyData.accounts,
  entries: companyData.entries,
  periods: companyData.periods,
  currency: company.currency,
};

const report = buildReportData({
  company,
  data: companyData,
  ledger,
  period: { from: "2025-01-01", to: "2025-12-31" },
});

describe("بناء التقرير الشامل", () => {
  it("يحتوي على المؤشرات والملخص التنفيذي", () => {
    expect(report.kpis).toHaveLength(8);
    expect(report.executiveSummary).toHaveLength(5);
    expect(report.executiveSummary[0]).toContain(company.name);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it("يعرض قوائم مالية متوازنة", () => {
    expect(report.balance.balanced).toBe(true);
    expect(report.trial.balanced).toBe(true);
    expect(report.income.lines.length).toBeGreaterThan(10);
    expect(report.balance.lines.length).toBeGreaterThan(10);
    expect(report.equity.lines.length).toBeGreaterThan(3);
  });

  it("يوثق مصادر البيانات وحدود التحليل", () => {
    expect(report.sources.length).toBeGreaterThanOrEqual(3);
    expect(report.sources.some((source) => source.includes("القيود المرحّلة"))).toBe(true);
    expect(report.limitations.some((limitation) => limitation.includes("رأياً قانونياً"))).toBe(true);
  });

  it("يتضمن الملاحظات والتكرار والشذوذ", () => {
    expect(Array.isArray(report.findings)).toBe(true);
    expect(report.duplicates.length).toBeGreaterThan(0);
    expect(report.anomalies.length).toBeGreaterThan(0);
  });

  it("يحسب النسب المالية دون قيم وهمية", () => {
    for (const ratio of report.analysis.ratios) {
      if (!ratio.available) {
        expect(ratio.value).toBeNull();
        expect(ratio.unavailableReason).toBeTruthy();
      } else {
        expect(Number.isFinite(ratio.value)).toBe(true);
      }
    }
  });

  it("ينتج تقريراً لشركة ذات أخطاء دون أن ينهار", () => {
    const troubled = companies[2];
    const troubledData = data[troubled.id];
    const troubledReport = buildReportData({
      company: troubled,
      data: troubledData,
      ledger: {
        accounts: troubledData.accounts,
        entries: troubledData.entries,
        periods: troubledData.periods,
        currency: troubled.currency,
      },
      period: { from: "2025-01-01", to: "2025-12-31" },
    });
    expect(troubledReport.findings.some((finding) => finding.code === "UNBALANCED_ENTRY")).toBe(true);
    expect(troubledReport.executiveSummary.join(" ")).toContain("فرق");
  });
});
