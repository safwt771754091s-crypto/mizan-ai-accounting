import { describe, expect, it } from "vitest";
import { checkPostableEntries } from "@/lib/import/guard";
import type { ImportEntryDraft } from "@/lib/import/types";

function draft(lines: ImportEntryDraft["lines"], entryNumber = "JE-1"): ImportEntryDraft {
  return { entryNumber, date: "2025-01-15", description: "قيد اختبار", lines };
}

describe("حارس الترحيل قبل الحفظ", () => {
  it("يقبل القيد المتوازن متعدد السطور", () => {
    const issues = checkPostableEntries([
      draft([
        { accountCode: "1100", debit: 1000, credit: 0 },
        { accountCode: "1200", debit: 500, credit: 0 },
        { accountCode: "4010", debit: 0, credit: 1500 },
      ]),
    ]);
    expect(issues).toEqual([]);
  });

  it("يرفض القيد غير المتوازن", () => {
    const issues = checkPostableEntries([
      draft([
        { accountCode: "1100", debit: 100, credit: 0 },
        { accountCode: "4010", debit: 0, credit: 90 },
      ]),
    ]);
    expect(issues.map((issue) => issue.code)).toContain("UNBALANCED");
  });

  it("يرفض القيد بسطر واحد", () => {
    const issues = checkPostableEntries([draft([{ accountCode: "1100", debit: 100, credit: 0 }])]);
    expect(issues.map((issue) => issue.code)).toEqual(["TOO_FEW_LINES"]);
  });

  it("يرفض السطر بلا حساب", () => {
    const issues = checkPostableEntries([
      draft([
        { accountCode: "", debit: 100, credit: 0 },
        { accountCode: "4010", debit: 0, credit: 100 },
      ]),
    ]);
    expect(issues.map((issue) => issue.code)).toContain("LINE_WITHOUT_ACCOUNT");
  });

  it("يرفض المبالغ السالبة والصفوف الصفرية والمدين والدائن معاً", () => {
    const issues = checkPostableEntries([
      draft([
        { accountCode: "1100", debit: -100, credit: 0 },
        { accountCode: "4010", debit: 100, credit: 0 },
        { accountCode: "1200", debit: 0, credit: 0 },
        { accountCode: "5010", debit: 50, credit: 50 },
      ]),
    ]);
    const codes = issues.map((issue) => issue.code);
    expect(codes).toContain("NEGATIVE_AMOUNT");
    expect(codes).toContain("ZERO_LINE");
    expect(codes).toContain("BOTH_SIDES");
  });

  it("يقبل دفعة قيود سليمة بالكامل", () => {
    const issues = checkPostableEntries([
      draft([
        { accountCode: "1100", debit: 250.75, credit: 0 },
        { accountCode: "4010", debit: 0, credit: 250.75 },
      ], "JE-1"),
      draft([
        { accountCode: "6010", debit: 0.1, credit: 0 },
        { accountCode: "1100", debit: 0.2, credit: 0 },
        { accountCode: "1020", debit: 0, credit: 0.3 },
      ], "JE-2"),
    ]);
    expect(issues).toEqual([]);
  });
});
