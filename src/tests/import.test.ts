import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseWorkbook } from "@/lib/import/parse";
import { suggestMapping } from "@/lib/import/detect";
import { validateRows } from "@/lib/import/validate";
import { buildImportPlan, inferAccountSubtype } from "@/lib/import/plan";
import { schemaFor } from "@/lib/import/datasets";
import type { ColumnMapping } from "@/lib/import/types";

const csv = [
  "رقم الحساب,اسم الحساب,مدين,دائن",
  "1010,النقدية,\"1,250,000.50\",0",
  "2010,الموردون,0,250000.50",
  "3010,رأس المال,0,\"1,000,000\"",
].join("\n");

describe("قراءة CSV", () => {
  it("يقرأ رؤوس الأعمدة والصفوف العربية", async () => {
    const result = await parseWorkbook({
      buffer: Buffer.from(csv, "utf8"),
      fileName: "trial.csv",
      kind: "csv",
    });
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].headers[0]).toContain("رقم الحساب");
    expect(result.sheets[0].rows).toHaveLength(3);
    expect(result.sheets[0].rows[0][2]).toBe("1,250,000.50");
  });

  it("يكتشف ربط الأعمدة تلقائياً", async () => {
    const result = await parseWorkbook({ buffer: Buffer.from(csv, "utf8"), fileName: "trial.csv", kind: "csv" });
    const suggestion = suggestMapping(result.sheets[0], schemaFor("trial_balance"));
    expect(suggestion.mapping.accountCode).toBe(0);
    expect(suggestion.mapping.accountName).toBe(1);
    expect(suggestion.mapping.debit).toBe(2);
    expect(suggestion.mapping.credit).toBe(3);
    expect(suggestion.requiredMissing).toHaveLength(0);
    expect(suggestion.confidence).toBeGreaterThan(50);
  });
});

describe("قراءة Excel", () => {
  it("يقرأ ملف XLSX متعدد الأوراق", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("قيود");
    sheet.addRow(["التاريخ", "رقم القيد", "البيان", "رقم الحساب", "مدين", "دائن"]);
    sheet.addRow(["2025-01-05", "JV-1", "مبيعات نقدية", "1010", 5000, 0]);
    sheet.addRow(["2025-01-05", "JV-1", "مبيعات نقدية", "4010", 0, 5000]);
    const second = workbook.addWorksheet("ورقة فارغة");
    second.addRow(["ملاحظات"]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await parseWorkbook({ buffer, fileName: "entries.xlsx", kind: "xlsx" });
    expect(result.sheets).toHaveLength(2);
    expect(result.sheets[0].name).toBe("قيود");
    expect(result.sheets[0].rows).toHaveLength(2);
    expect(result.sheets[0].rows[0][4]).toBe("5000");
  });
});

describe("التحقق من الصفوف", () => {
  it("يكتشف الحقول المطلوبة والتواريخ غير الصالحة", () => {
    const rows = [
      ["1010", "النقدية", "1000", "0"],
      ["", "بدون رقم", "200", "0"],
      ["2010", "الموردون", "abc", "0"],
    ];
    const mapping: ColumnMapping = { accountCode: 0, accountName: 1, debit: 2, credit: 3 };
    const result = validateRows({ rows, schema: schemaFor("trial_balance"), mapping });
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.code === "REQUIRED_FIELD_MISSING")).toBe(true);
    expect(result.issues.some((i) => i.code === "INVALID_MONEY")).toBe(true);
    expect(result.rows).toHaveLength(2);
  });

  it("يكتشف تكرار الصفوف داخل الملف", () => {
    const rows = [
      ["1010", "النقدية", "1000", "0"],
      ["1010", "النقدية", "1000", "0"],
    ];
    const mapping: ColumnMapping = { accountCode: 0, accountName: 1, debit: 2, credit: 3 };
    const result = validateRows({ rows, schema: schemaFor("trial_balance"), mapping });
    expect(result.duplicateRowCount).toBe(1);
    expect(result.issues.some((i) => i.code === "DUPLICATE_ROW")).toBe(true);
  });

  it("يتعامل مع الأرقام العربية والفواصل", () => {
    const rows = [["1010", "النقدية", "١٬٢٥٠٫٥٠", "0"]];
    const mapping: ColumnMapping = { accountCode: 0, accountName: 1, debit: 2, credit: 3 };
    const result = validateRows({ rows, schema: schemaFor("trial_balance"), mapping });
    expect(result.rows[0].values.debit).toBe("1250.50");
    expect(result.totalDebit).toBe(1250.5);
  });
});

describe("بناء خطة الاستيراد", () => {
  it("يبني حسابات من ميزان المراجعة", () => {
    const result = validateRows({
      rows: [
        ["1010", "النقدية", "100000", "0"],
        ["3010", "رأس المال", "0", "100000"],
      ],
      schema: schemaFor("trial_balance"),
      mapping: { accountCode: 0, accountName: 1, debit: 2, credit: 3 },
    });
    const plan = buildImportPlan({ dataset: "trial_balance", rows: result.rows, issues: result.issues });
    expect(plan.accounts).toHaveLength(2);
    expect(plan.summary.balanced).toBe(true);
    expect(plan.accounts[0].subtype).toBe("cash");
    expect(plan.accounts[1].subtype).toBe("capital");
  });

  it("يرفض ميزان مراجعة غير متوازن", () => {
    const result = validateRows({
      rows: [
        ["1010", "النقدية", "100000", "0"],
        ["3010", "رأس المال", "0", "90000"],
      ],
      schema: schemaFor("trial_balance"),
      mapping: { accountCode: 0, accountName: 1, debit: 2, credit: 3 },
    });
    const plan = buildImportPlan({ dataset: "trial_balance", rows: result.rows, issues: result.issues });
    expect(plan.summary.balanced).toBe(false);
    expect(plan.issues.some((i) => i.code === "TRIAL_BALANCE_NOT_BALANCED" && i.level === "error")).toBe(true);
  });

  it("يجمّع القيود اليومية ويتحقق من توازنها", () => {
    const result = validateRows({
      rows: [
        ["2025-01-01", "JV-1", "مبيعات", "1010", "5000", "0"],
        ["2025-01-01", "JV-1", "مبيعات", "4010", "0", "5000"],
        ["2025-01-02", "JV-2", "قيد ناقص", "1010", "3000", "0"],
        ["2025-01-02", "JV-2", "قيد ناقص", "4010", "0", "2000"],
      ],
      schema: schemaFor("journal_entries"),
      mapping: { date: 0, entryNumber: 1, description: 2, accountCode: 3, debit: 4, credit: 5 },
    });
    const plan = buildImportPlan({ dataset: "journal_entries", rows: result.rows, issues: result.issues });
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0].lines).toHaveLength(2);
    expect(plan.issues.some((i) => i.code === "ENTRY_NOT_BALANCED")).toBe(true);
  });

  it("يستنتج تصنيف الحسابات من الاسم", () => {
    expect(inferAccountSubtype("1020", "البنك الأهلي", "").subtype).toBe("bank");
    expect(inferAccountSubtype("1030", "العملاء", "").subtype).toBe("receivable");
    expect(inferAccountSubtype("4010", "إيرادات المبيعات", "").subtype).toBe("sales");
    expect(inferAccountSubtype("6010", "الرواتب والأجور", "").subtype).toBe("admin_expense");
    expect(inferAccountSubtype("1220", "مجمع إهلاك السيارات", "").subtype).toBe("accumulated_depreciation");
  });

  it("يحفظ السجلات دون قيود عند غياب الحسابات", () => {
    const result = validateRows({
      rows: [["2025-01-01", "INV-1", "مبيعات", "1000"]],
      schema: schemaFor("sales"),
      mapping: { date: 0, reference: 1, description: 2, amount: 3 },
    });
    const plan = buildImportPlan({ dataset: "sales", rows: result.rows, issues: result.issues });
    expect(plan.entries).toHaveLength(0);
    expect(plan.records).toHaveLength(1);
    expect(plan.warnings.length).toBeGreaterThan(0);
  });
});
