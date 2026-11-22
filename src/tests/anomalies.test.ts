import { describe, expect, it } from "vitest";
import { DEFAULT_ANOMALY_RULES, detectAnomalies, summarizeAnomalies } from "@/lib/accounting/anomalies";
import { testAccounts, testLedger } from "./fixtures";
import type { JournalEntry, Ledger } from "@/lib/accounting/types";

function expenseEntry(id: string, date: string, amount: number, code = "6030", ref?: string): JournalEntry {
  return {
    id,
    entryNumber: `EXP-${id}`,
    date,
    description: "مصروف تشغيلي",
    source: "expense",
    status: "posted",
    reference: ref ?? null,
    lines: [
      { accountCode: code, debit: amount, credit: 0 },
      { accountCode: "1010", debit: 0, credit: amount },
    ],
  };
}

const months = ["01", "02", "03", "04", "05", "06"];
const spikeLedger: Ledger = {
  accounts: [
    ...testAccounts,
    { id: "x1", code: "6030", name: "مصروفات تشغيلية", type: "expense", subtype: "operating_expense", isActive: true },
  ],
  entries: [
    ...testLedger.entries,
    ...months.map((m, index) => expenseEntry(`m${index}`, `2025-${m}-15`, index === 4 ? 15000 : 1000)),
  ],
  currency: "SAR",
};

describe("تحليل المصروفات غير المعتادة", () => {
  it("يكتشف الارتفاع غير المعتاد في شهر محدد", () => {
    const anomalies = detectAnomalies(spikeLedger, { from: "2025-01-01", to: "2025-12-31" });
    const spike = anomalies.find((a) => a.category === "expense_spike" && a.period === "2025-05");
    expect(spike).toBeDefined();
    expect(spike?.amount).toBe(15000);
    expect(spike?.reasons.length).toBeGreaterThan(0);
    expect(spike?.description).toContain("ليست دليلاً على");
  });

  it("يكتشف المبالغ المتكررة", () => {
    const repeated: Ledger = {
      ...spikeLedger,
      entries: [
        ...testLedger.entries,
        ...["01", "02", "03", "04"].map((m, i) => expenseEntry(`r${i}`, `2025-${m}-10`, 2500)),
      ],
    };
    const anomalies = detectAnomalies(repeated, { from: "2025-01-01", to: "2025-12-31" });
    expect(anomalies.some((a) => a.category === "repeated_amount")).toBe(true);
  });

  it("يكتشف المصروفات الكبيرة بدون مستند", () => {
    const anomalies = detectAnomalies(spikeLedger, { from: "2025-01-01", to: "2025-12-31" });
    expect(anomalies.some((a) => a.category === "documentation")).toBe(true);
  });

  it("يحترم القواعد القابلة للتخصيص", () => {
    const anomalies = detectAnomalies(spikeLedger, {
      from: "2025-01-01",
      to: "2025-12-31",
      rules: { documentationThreshold: 1_000_000, expenseSpikeRatio: 100, concentrationShare: 100 },
    });
    expect(anomalies.some((a) => a.category === "documentation")).toBe(false);
    expect(anomalies.some((a) => a.category === "expense_spike")).toBe(false);
  });

  it("يعطي درجة ومستوى خطورة لكل نتيجة", () => {
    const anomalies = detectAnomalies(spikeLedger, { from: "2025-01-01", to: "2025-12-31" });
    for (const item of anomalies) {
      expect(item.score).toBeGreaterThan(0);
      expect(item.score).toBeLessThanOrEqual(100);
      expect(["critical", "high", "medium", "low", "info"]).toContain(item.severity);
    }
    const summary = summarizeAnomalies(anomalies);
    expect(Object.values(summary).reduce((a, b) => a + b, 0)).toBe(anomalies.length);
  });

  it("يملك قواعد افتراضية موثقة", () => {
    expect(DEFAULT_ANOMALY_RULES.outlierStdFactor).toBeGreaterThan(1);
    expect(DEFAULT_ANOMALY_RULES.documentationThreshold).toBeGreaterThan(0);
  });
});
