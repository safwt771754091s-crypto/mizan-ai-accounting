import { describe, expect, it } from "vitest";
import { detectDuplicates, totalDuplicateExposure } from "@/lib/accounting/duplicates";
import { duplicatePair, testLedger } from "./fixtures";
import type { JournalEntry } from "@/lib/accounting/types";

function withEntries(entries: JournalEntry[]) {
  return { ...testLedger, entries: [...testLedger.entries, ...entries] };
}

describe("اكتشاف القيود المكررة", () => {
  it("يكتشف التكرار القوي بنفس المرجع والمبلغ والتاريخ", () => {
    const groups = detectDuplicates(withEntries(duplicatePair), { from: "2025-01-01", to: "2025-12-31" });
    const group = groups.find((g) => g.entries.length >= 2 && g.entries.some((e) => e.reference === "PUR-777"));
    expect(group).toBeDefined();
    expect(group?.strength).toBe("strong");
    expect(group?.reasons).toContain("رقم المستند/الفاتورة متطابق");
    expect(group?.score).toBeGreaterThanOrEqual(80);
  });

  it("يكتشف التشابه في الوصف مع اختلاف المرجع", () => {
    const similar: JournalEntry[] = [
      {
        id: "s1",
        entryNumber: "S-1",
        date: "2025-04-01",
        description: "فاتورة شراء مواد تنظيف من مورد الوفاء",
        source: "purchase",
        status: "posted",
        reference: "A-1",
        lines: [
          { accountCode: "1040", debit: 12000, credit: 0 },
          { accountCode: "2010", debit: 0, credit: 12000 },
        ],
      },
      {
        id: "s2",
        entryNumber: "S-2",
        date: "2025-04-02",
        description: "فاتورة شراء مواد تنظيف من مورد الوفاء",
        source: "purchase",
        status: "posted",
        reference: "A-2",
        lines: [
          { accountCode: "1040", debit: 12000, credit: 0 },
          { accountCode: "2010", debit: 0, credit: 12000 },
        ],
      },
    ];
    const groups = detectDuplicates(withEntries(similar), {
      from: "2025-01-01",
      to: "2025-12-31",
      minScore: 40,
    });
    expect(groups.some((g) => g.entries.some((e) => e.entryId === "s1"))).toBe(true);
  });

  it("لا يخلط بين العمليات المختلفة", () => {
    const groups = detectDuplicates(testLedger, { from: "2025-01-01", to: "2025-12-31" });
    const unrelated = groups.find((g) => g.entries.some((e) => e.entryNumber === "INV-001"));
    expect(unrelated).toBeUndefined();
  });

  it("يعطي توصية بعدم الحذف التلقائي", () => {
    const groups = detectDuplicates(withEntries(duplicatePair), { from: "2025-01-01", to: "2025-12-31" });
    expect(groups[0].recommendation).toContain("لا تحذف");
  });

  it("يحسب التعرض المالي للتكرار", () => {
    const groups = detectDuplicates(withEntries(duplicatePair), { from: "2025-01-01", to: "2025-12-31" });
    expect(totalDuplicateExposure(groups)).toBeGreaterThanOrEqual(25000);
  });
});
