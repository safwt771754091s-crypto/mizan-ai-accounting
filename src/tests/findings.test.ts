import { describe, expect, it } from "vitest";
import { detectAuditFindings, summarizeFindings } from "@/lib/accounting/findings";
import { testLedger, unbalancedEntry, unknownAccountEntry } from "./fixtures";

const range = { from: "2025-01-01", to: "2025-12-31" };

describe("اكتشاف الأخطاء المحاسبية", () => {
  it("يكتشف القيود غير المتوازنة", () => {
    const ledger = { ...testLedger, entries: [...testLedger.entries, unbalancedEntry] };
    const findings = detectAuditFindings(ledger, range);
    const item = findings.find((f) => f.code === "UNBALANCED_ENTRY");
    expect(item).toBeDefined();
    expect(item?.severity).toBe("critical");
    expect(item?.amount).toBe(100);
    expect(item?.reason).toBeTruthy();
    expect(item?.recommendation).toBeTruthy();
  });

  it("يكتشف الحسابات غير الموجودة في الدليل", () => {
    const ledger = { ...testLedger, entries: [...testLedger.entries, unknownAccountEntry] };
    const findings = detectAuditFindings(ledger, range);
    const item = findings.find((f) => f.code === "UNKNOWN_ACCOUNT");
    expect(item?.accountCode).toBe("9999");
    expect(item?.severity).toBe("high");
  });

  it("يكتشف فرق ميزان المراجعة", () => {
    const ledger = { ...testLedger, entries: [...testLedger.entries, unbalancedEntry] };
    const findings = detectAuditFindings(ledger, range);
    expect(findings.some((f) => f.code === "TRIAL_BALANCE_DIFFERENCE")).toBe(true);
  });

  it("يكتشف رصيد النقدية السالب", () => {
    const ledger = {
      ...testLedger,
      entries: [
        ...testLedger.entries,
        {
          id: "neg-cash",
          entryNumber: "NEG-1",
          date: "2025-08-01",
          description: "سحب كبير",
          source: "manual",
          status: "posted" as const,
          lines: [
            { accountCode: "3030", debit: 500000, credit: 0 },
            { accountCode: "1010", debit: 0, credit: 500000 },
          ],
        },
      ],
    };
    const findings = detectAuditFindings(ledger, range);
    const item = findings.find((f) => f.code === "ABNORMAL_BALANCE" && f.accountCode === "1010");
    expect(item).toBeDefined();
    expect(item?.severity).toBe("critical");
  });

  it("يكتشف العمليات الكبيرة بدون مستند", () => {
    const ledger = {
      ...testLedger,
      entries: [
        ...testLedger.entries,
        {
          id: "no-doc",
          entryNumber: "ND-1",
          date: "2025-09-01",
          description: "مصروف صيانة كبير",
          source: "manual",
          status: "posted" as const,
          reference: null,
          lines: [
            { accountCode: "6010", debit: 25000, credit: 0 },
            { accountCode: "1010", debit: 0, credit: 25000 },
          ],
        },
      ],
    };
    const findings = detectAuditFindings(ledger, { ...range, documentationThreshold: 10000 });
    expect(findings.some((f) => f.code === "MISSING_DOCUMENT")).toBe(true);
  });

  it("يكتشف أرقام القيود المكررة", () => {
    const ledger = {
      ...testLedger,
      entries: [
        ...testLedger.entries,
        {
          ...testLedger.entries[1],
          id: "dup-number",
          description: "قيد آخر بنفس الرقم",
        },
      ],
    };
    const findings = detectAuditFindings(ledger, range);
    expect(findings.some((f) => f.code === "DUPLICATE_ENTRY_NUMBER")).toBe(true);
  });

  it("يرتب النتائج حسب الخطورة ويعطي ملخصاً", () => {
    const ledger = { ...testLedger, entries: [...testLedger.entries, unbalancedEntry, unknownAccountEntry] };
    const findings = detectAuditFindings(ledger, range);
    expect(findings[0].severity).toBe("critical");
    const summary = summarizeFindings(findings);
    expect(summary.critical).toBeGreaterThan(0);
    expect(Object.values(summary).reduce((a, b) => a + b, 0)).toBe(findings.length);
  });

  it("لا ينتج أخطاء في دفتر متوازن وسليم", () => {
    const findings = detectAuditFindings(testLedger, range);
    expect(findings.some((f) => f.severity === "critical")).toBe(false);
  });
});
