import { toMoney } from "../accounting/money";
import { SUBTYPE_META } from "../accounting/accounts";
import type { AccountSubtype, AccountType } from "../accounting/types";
import { normalizeArabic } from "../utils/similarity";
import type { ImportDataset, ImportEntryDraft, ImportIssue, ImportPlan, NormalizedRow } from "./types";

const SUBTYPE_BY_KEYWORD: Array<{ pattern: RegExp; subtype: AccountSubtype }> = [
  { pattern: /مجمع الاهلاك|مجمع اهلاك|accumulated depreciation/, subtype: "accumulated_depreciation" },
  { pattern: /نقد|صندوق|cash/, subtype: "cash" },
  { pattern: /بنك|مصرف|bank/, subtype: "bank" },
  { pattern: /عميل|عملاء|مدينون|ذمم مدينه|receivable|accounts receivable/, subtype: "receivable" },
  { pattern: /مخزون|بضاعه|inventory|stock/, subtype: "inventory" },
  { pattern: /اصول ثابته|سيارات|عقار|معدات|اثاث|fixed asset|property|equipment/, subtype: "fixed_asset" },
  { pattern: /مورد|موردون|موردين|دائنون|ذمم دائنه|payable|accounts payable/, subtype: "payable" },
  { pattern: /ضريبه|ضرائب|vat|tax payable/, subtype: "tax_payable" },
  { pattern: /قرض قصير|تسهيلات|short term loan|overdraft/, subtype: "short_term_loan" },
  { pattern: /قرض طويل|قروض طويله|long term loan/, subtype: "long_term_liability" },
  { pattern: /راس المال|capital/, subtype: "capital" },
  { pattern: /ارباح محتجزه|ارباح مدوره|retained earnings/, subtype: "retained_earnings" },
  { pattern: /مسحوبات|توزيعات|drawings|dividends/, subtype: "drawings" },
  { pattern: /مردودات|مسموحات|returns/, subtype: "sales_returns" },
  { pattern: /تكلفه المبيعات|تكلفه البضاعه|cost of sales|cogs/, subtype: "cost_of_sales" },
  { pattern: /مبيعات|ايرادات|revenue|sales/, subtype: "sales" },
  { pattern: /رواتب|اجور|salaries|wages/, subtype: "admin_expense" },
  { pattern: /ايجار|rent/, subtype: "admin_expense" },
  { pattern: /تسويق|اعلان|marketing|advertising/, subtype: "marketing_expense" },
  { pattern: /اهلاك|depreciation/, subtype: "depreciation" },
  { pattern: /فوائد|ماليه|finance|interest/, subtype: "finance_expense" },
  { pattern: /ضريبه الدخل|income tax/, subtype: "tax_expense" },
];

const TYPE_BY_TEXT: Record<string, AccountType> = {
  asset: "asset",
  assets: "asset",
  "أصول": "asset",
  "اصول": "asset",
  liability: "liability",
  liabilities: "liability",
  "التزامات": "liability",
  "خصوم": "liability",
  equity: "equity",
  "حقوق ملكية": "equity",
  "حقوق الملكية": "equity",
  revenue: "revenue",
  "إيرادات": "revenue",
  "ايرادات": "revenue",
  expense: "expense",
  expenses: "expense",
  "مصروفات": "expense",
};

export function inferAccountSubtype(code: string, name: string, typeText?: string): {
  subtype: AccountSubtype;
  type: AccountType;
  confident: boolean;
} {
  const text = normalizeArabic(`${name} ${typeText ?? ""}`);
  for (const rule of SUBTYPE_BY_KEYWORD) {
    if (rule.pattern.test(text)) {
      return { subtype: rule.subtype, type: SUBTYPE_META[rule.subtype].type, confident: true };
    }
  }
  const normalizedType = normalizeArabic(typeText ?? "");
  const type = TYPE_BY_TEXT[normalizedType] ?? TYPE_BY_TEXT[typeText?.trim() ?? ""];
  if (type === "asset") return { subtype: "other_asset", type, confident: false };
  if (type === "liability") return { subtype: "other_current_liability", type, confident: false };
  if (type === "equity") return { subtype: "retained_earnings", type, confident: false };
  if (type === "revenue") return { subtype: "sales", type, confident: false };
  if (type === "expense") return { subtype: "operating_expense", type, confident: false };
  if (/^1/.test(code)) return { subtype: "other_asset", type: "asset", confident: false };
  if (/^2/.test(code)) return { subtype: "other_current_liability", type: "liability", confident: false };
  if (/^3/.test(code)) return { subtype: "retained_earnings", type: "equity", confident: false };
  if (/^4/.test(code)) return { subtype: "sales", type: "revenue", confident: false };
  if (/^[5-9]/.test(code)) return { subtype: "operating_expense", type: "expense", confident: false };
  return { subtype: "other_asset", type: "asset", confident: false };
}

function moneyOf(row: NormalizedRow, key: string): number {
  const value = row.values[key];
  if (!value) return 0;
  return toMoney(value).toNumber();
}

export function buildImportPlan(params: {
  dataset: ImportDataset;
  rows: NormalizedRow[];
  issues: ImportIssue[];
}): ImportPlan {
  const { dataset, rows } = params;
  const issues = [...params.issues];
  const warnings: string[] = [];
  const accounts: ImportPlan["accounts"] = [];
  const entries: ImportEntryDraft[] = [];
  const records: NormalizedRow[] = [];

  const addError = (code: string, message: string, row = 0) => {
    issues.push({ row, code, message, level: "error" });
  };

  if (dataset === "trial_balance") {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const row of rows) {
      const code = (row.values.accountCode ?? "").trim();
      const name = (row.values.accountName ?? "").trim();
      if (!code || !name) continue;
      let debit = moneyOf(row, "debit");
      let credit = moneyOf(row, "credit");
      if (debit === 0 && credit === 0) {
        const balance = moneyOf(row, "balance");
        if (balance > 0) debit = balance;
        else if (balance < 0) credit = Math.abs(balance);
      }
      totalDebit += debit;
      totalCredit += credit;
      const inferred = inferAccountSubtype(code, name, row.values.accountType);
      accounts.push({
        code,
        name,
        debit,
        credit,
        subtype: inferred.subtype,
        accountType: inferred.type,
        inferenceNote: inferred.confident ? undefined : "تصنيف تقديري — راجع نوع الحساب",
      });
      if (!inferred.confident) {
        warnings.push(`تم تصنيف الحساب ${code} - ${name} تصنيفاً تقديرياً (${SUBTYPE_META[inferred.subtype].label}). راجع التصنيف.`);
      }
    }
    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      addError(
        "TRIAL_BALANCE_NOT_BALANCED",
        `ميزان المراجعة غير متوازن: إجمالي المدين ${totalDebit.toFixed(2)} وإجمالي الدائن ${totalCredit.toFixed(2)}. صحّح الملف قبل الاستيراد.`,
      );
    }
    return {
      dataset,
      accounts,
      entries,
      records,
      issues,
      summary: {
        rowCount: rows.length,
        entryCount: 0,
        accountCount: accounts.length,
        totalDebit: Number(totalDebit.toFixed(2)),
        totalCredit: Number(totalCredit.toFixed(2)),
        balanced: Math.abs(totalDebit - totalCredit) < 0.01,
        difference: Number((totalDebit - totalCredit).toFixed(2)),
      },
      warnings,
    };
  }

  if (dataset === "journal_entries" || dataset === "general_ledger") {
    const groups = new Map<string, NormalizedRow[]>();
    for (const row of rows) {
      const key =
        row.values.entryNumber?.trim() ||
        `${row.values.date ?? ""}|${row.values.description ?? ""}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    let index = 0;
    for (const [key, group] of groups) {
      index += 1;
      const first = group[0];
      const lines = group
        .map((row) => ({
          accountCode: (row.values.accountCode ?? "").trim(),
          accountName: row.values.accountName?.trim() || undefined,
          debit: moneyOf(row, "debit"),
          credit: moneyOf(row, "credit"),
          description: row.values.description?.trim() || undefined,
          costCenter: row.values.costCenter?.trim() || undefined,
          branch: row.values.branch?.trim() || undefined,
        }))
        .filter((line) => line.accountCode);
      if (!lines.length) continue;
      const debit = lines.reduce((s, l) => s + l.debit, 0);
      const credit = lines.reduce((s, l) => s + l.credit, 0);
      if (Math.abs(debit - credit) >= 0.01) {
        addError(
          "ENTRY_NOT_BALANCED",
          `القيد ${key} غير متوازن: مدين ${debit.toFixed(2)} مقابل دائن ${credit.toFixed(2)}.`,
          first.rowNumber,
        );
        continue;
      }
      entries.push({
        entryNumber: first.values.entryNumber?.trim() || `IMP-${String(index).padStart(4, "0")}`,
        date: first.values.date ?? "",
        description: first.values.description?.trim() || "قيد مستورد",
        reference: first.values.reference?.trim() || undefined,
        lines,
      });
    }
    return {
      dataset,
      accounts,
      entries,
      records,
      issues,
      summary: {
        rowCount: rows.length,
        entryCount: entries.length,
        accountCount: 0,
        totalDebit: Number(entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.debit, 0), 0).toFixed(2)),
        totalCredit: Number(entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.credit, 0), 0).toFixed(2)),
        balanced: true,
        difference: 0,
      },
      warnings,
    };
  }

  if (dataset === "sales" || dataset === "purchases" || dataset === "expenses") {
    const canBuildEntries = rows.every((row) => {
      if (dataset === "expenses") {
        return Boolean(row.values.debitAccount || row.values.accountCode) && Boolean(row.values.creditAccount);
      }
      return Boolean(row.values.debitAccount) && Boolean(row.values.creditAccount);
    });
    if (!canBuildEntries) {
      warnings.push(
        "لم يتم تحديد الحسابات المدينة والدائنة لكل الصفوف، لذلك سيتم حفظ البيانات كسجلات مستوردة دون إنشاء قيود محاسبية. يمكن ربط الحسابات لاحقاً.",
      );
      records.push(...rows);
      return {
        dataset,
        accounts,
        entries,
        records,
        issues,
        summary: {
          rowCount: rows.length,
          entryCount: 0,
          accountCount: 0,
          totalDebit: 0,
          totalCredit: 0,
          balanced: true,
          difference: 0,
        },
        warnings,
      };
    }
    rows.forEach((row, index) => {
      const amount = moneyOf(row, "amount");
      if (amount <= 0) return;
      const debitAccount = (row.values.debitAccount || row.values.accountCode || "").trim();
      const creditAccount = (row.values.creditAccount || "").trim();
      if (!debitAccount || !creditAccount) return;
      const tax = moneyOf(row, "tax");
      if (tax > 0) {
        warnings.push(
          `الصف ${row.rowNumber}: يحتوي مبلغ ضريبة ${tax.toFixed(2)} ولم يتم فصله لعدم وجود حساب ضريبة محدد. المبلغ سيُرحّل بالكامل على الحساب المدين.`,
        );
      }
      entries.push({
        entryNumber: row.values.reference?.trim() || `IMP-${String(index + 1).padStart(4, "0")}`,
        date: row.values.date ?? "",
        description: row.values.description?.trim() || `${dataset === "sales" ? "فاتورة مبيعات" : dataset === "purchases" ? "فاتورة مشتريات" : "مصروف"} مستورد`,
        reference: row.values.reference?.trim() || undefined,
        lines: [
          { accountCode: debitAccount, debit: amount, credit: 0, description: row.values.party?.trim() || undefined },
          { accountCode: creditAccount, debit: 0, credit: amount },
        ],
      });
      records.push(row);
    });
    return {
      dataset,
      accounts,
      entries,
      records,
      issues,
      summary: {
        rowCount: rows.length,
        entryCount: entries.length,
        accountCount: 0,
        totalDebit: Number(entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.debit, 0), 0).toFixed(2)),
        totalCredit: Number(entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.credit, 0), 0).toFixed(2)),
        balanced: true,
        difference: 0,
      },
      warnings,
    };
  }

  records.push(...rows);
  return {
    dataset,
    accounts,
    entries,
    records,
    issues,
    summary: {
      rowCount: rows.length,
      entryCount: 0,
      accountCount: 0,
      totalDebit: 0,
      totalCredit: 0,
      balanced: true,
      difference: 0,
    },
    warnings,
  };
}
