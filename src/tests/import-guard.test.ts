import { describe, expect, it } from "vitest";
import { checkPostableEntries } from "@/lib/import/guard";
import { parseWorkbook } from "@/lib/import/parse";
import { suggestMapping } from "@/lib/import/detect";
import { validateRows } from "@/lib/import/validate";
import { buildImportPlan } from "@/lib/import/plan";
import { schemaFor } from "@/lib/import/datasets";
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

  it("يرفض المبالغ السالبة والسطر المدين والدائن معاً", () => {
    const issues = checkPostableEntries([
      draft([
        { accountCode: "1100", debit: -100, credit: 0 },
        { accountCode: "4010", debit: 100, credit: 0 },
        { accountCode: "5010", debit: 50, credit: 50 },
      ]),
    ]);
    const codes = issues.map((issue) => issue.code);
    expect(codes).toContain("NEGATIVE_AMOUNT");
    expect(codes).toContain("BOTH_SIDES");
  });

  it("لا يرفض القيد السليم بسبب سطر بمبلغ صفر", () => {
    const issues = checkPostableEntries([
      draft([
        { accountCode: "6010", debit: 500, credit: 0 },
        { accountCode: "1020", debit: 0, credit: 500 },
        { accountCode: "5010", debit: 0, credit: 0 },
      ]),
    ]);
    expect(issues).toEqual([]);
  });

  it("يتكامل مع مسار الاستيراد الحقيقي (CSV → خطة → حارس)", async () => {
    const csv = [
      "رقم القيد,التاريخ,الوصف,رقم الحساب,مدين,دائن",
      "JE-1,2025-03-01,مبيعات,1100,1000,0",
      "JE-1,2025-03-01,مبيعات,4010,0,1000",
      "JE-2,2025-03-02,إيجار,6010,500,0",
      "JE-2,2025-03-02,إيجار,1020,0,500",
      "JE-2,2025-03-02,سطر فارغ,5010,0,0",
    ].join("\n");
    const schema = schemaFor("journal_entries");
    const parsed = await parseWorkbook({ buffer: Buffer.from(csv, "utf8"), fileName: "je.csv", kind: "csv" });
    const sheet = parsed.sheets[0];
    const mapping = suggestMapping(sheet, schema).mapping;
    const validated = validateRows({ rows: sheet.rows, schema, mapping });
    const plan = buildImportPlan({ dataset: "journal_entries", rows: validated.rows, issues: validated.issues });
    expect(plan.entries).toHaveLength(2);
    expect(checkPostableEntries(plan.entries)).toEqual([]);
  });

  it("يمنع قيداً غير متوازن قادماً من ملف حقيقي", async () => {
    const csv = [
      "رقم القيد,التاريخ,الوصف,رقم الحساب,مدين,دائن",
      "JE-9,2025-03-01,قيد خاطئ,1100,1000,0",
      "JE-9,2025-03-01,قيد خاطئ,4010,0,900",
    ].join("\n");
    const schema = schemaFor("journal_entries");
    const parsed = await parseWorkbook({ buffer: Buffer.from(csv, "utf8"), fileName: "bad.csv", kind: "csv" });
    const mapping = suggestMapping(parsed.sheets[0], schema).mapping;
    const validated = validateRows({ rows: parsed.sheets[0].rows, schema, mapping });
    const plan = buildImportPlan({ dataset: "journal_entries", rows: validated.rows, issues: validated.issues });
    expect(plan.entries).toHaveLength(0);
    expect(plan.issues.some((issue) => issue.code === "ENTRY_NOT_BALANCED")).toBe(true);
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
