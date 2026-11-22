import { toMoney } from "../accounting/money";
import { parseDateValue } from "../utils/dates";
import { normalizeArabic } from "../utils/similarity";
import type {
  ColumnMapping,
  DatasetSchema,
  ImportIssue,
  NormalizedRow,
  ValidationResult,
} from "./types";

export function validateRows(params: {
  rows: string[][];
  schema: DatasetSchema;
  mapping: ColumnMapping;
  headerRowIndex?: number;
}): ValidationResult {
  const { rows, schema, mapping } = params;
  const issues: ImportIssue[] = [];
  const normalized: NormalizedRow[] = [];
  const seen = new Map<string, number>();
  let duplicateRowCount = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const mappedFields = schema.fields.filter((f) => mapping[f.key] !== null && mapping[f.key] !== undefined);
  const requiredFields = schema.fields.filter((f) => f.required);

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (!row.some((cell) => String(cell ?? "").trim())) return;

    const values: Record<string, string> = {};
    for (const field of mappedFields) {
      const column = mapping[field.key];
      const raw = column === null || column === undefined ? "" : String(row[column] ?? "").trim();
      values[field.key] = raw;
    }

    let hasError = false;
    for (const field of requiredFields) {
      const value = values[field.key] ?? "";
      if (!value) {
        issues.push({
          row: rowNumber,
          field: field.key,
          code: "REQUIRED_FIELD_MISSING",
          message: `الحقل المطلوب «${field.label}» فارغ في الصف ${rowNumber}.`,
          level: "error",
        });
        hasError = true;
      }
    }

    for (const field of mappedFields) {
      const raw = values[field.key];
      if (!raw) continue;
      if (field.type === "money") {
        const parsed = toMoney(raw);
        if (parsed.isZero() && !/^[-+(]?[\s٠0.,٬٫]*\)?$/.test(raw)) {
          issues.push({
            row: rowNumber,
            field: field.key,
            code: "INVALID_MONEY",
            message: `تعذر قراءة مبلغ صحيح من «${raw}» في عمود ${field.label}.`,
            level: "warning",
          });
        }
        values[field.key] = parsed.toFixed(2);
      }
      if (field.type === "date") {
        const parsed = parseDateValue(raw);
        if (!parsed) {
          issues.push({
            row: rowNumber,
            field: field.key,
            code: "INVALID_DATE",
            message: `تاريخ غير صالح «${raw}» في عمود ${field.label}. استخدم صيغة YYYY-MM-DD أو DD/MM/YYYY.`,
            level: "error",
          });
          hasError = true;
        } else {
          values[field.key] = parsed;
        }
      }
      if (field.type === "number") {
        const parsed = toMoney(raw);
        values[field.key] = parsed.toString();
      }
    }

    const debit = values.debit ? toMoney(values.debit).toNumber() : 0;
    const credit = values.credit ? toMoney(values.credit).toNumber() : 0;
    if (debit < 0 || credit < 0) {
      issues.push({
        row: rowNumber,
        code: "NEGATIVE_AMOUNT",
        message: `الصف ${rowNumber} يحتوي مبلغاً سالباً. استخدم الطرف المدين/الدائن بدلاً من الإشارة السالبة.`,
        level: "warning",
      });
    }
    totalDebit += debit;
    totalCredit += credit;

    if (debit > 0 && credit > 0) {
      issues.push({
        row: rowNumber,
        code: "BOTH_DEBIT_AND_CREDIT",
        message: `الصف ${rowNumber} يحتوي مديناً ودائناً معاً.`,
        level: "warning",
      });
    }

    const key = schema.duplicateKeys
      .map((k) => normalizeArabic(values[k] ?? ""))
      .join("|");
    if (key.replace(/\|/g, "").trim()) {
      const previous = seen.get(key);
      if (previous !== undefined) {
        duplicateRowCount += 1;
        issues.push({
          row: rowNumber,
          code: "DUPLICATE_ROW",
          message: `الصف ${rowNumber} يبدو مكرراً للصف ${previous} داخل الملف نفسه.`,
          level: "warning",
        });
      } else {
        seen.set(key, rowNumber);
      }
    }

    if (!hasError) {
      normalized.push({
        rowNumber,
        values,
        amount: debit || credit,
        date: values.date,
      });
    }
  });

  const difference = totalDebit - totalCredit;
  const hasDebitCredit = schema.fields.some((f) => f.key === "debit") && schema.fields.some((f) => f.key === "credit");
  const balanced = !hasDebitCredit || Math.abs(difference) < 0.01;
  if (hasDebitCredit && !balanced && (totalDebit > 0 || totalCredit > 0)) {
    issues.push({
      row: 0,
      code: "FILE_NOT_BALANCED",
      message: `إجمالي المدين (${totalDebit.toFixed(2)}) لا يساوي إجمالي الدائن (${totalCredit.toFixed(2)}) بفرق ${difference.toFixed(2)}.`,
      level: "warning",
    });
  }

  return {
    rows: normalized,
    issues,
    errorCount: issues.filter((i) => i.level === "error").length,
    warningCount: issues.filter((i) => i.level === "warning").length,
    duplicateRowCount,
    totalDebit: Number(totalDebit.toFixed(2)),
    totalCredit: Number(totalCredit.toFixed(2)),
    balanced,
    difference: Number(difference.toFixed(2)),
  };
}
