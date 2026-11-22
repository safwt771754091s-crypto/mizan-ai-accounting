import { dec } from "../accounting/money";
import { entryTotals } from "../accounting/engine";
import type { ImportEntryDraft } from "./types";

export interface PostingIssue {
  entryNumber: string;
  code: string;
  message: string;
}

/**
 * فحص أخير قبل الحفظ: يمنع ترحيل أي قيد غير صالح مهما كان مصدر الخطة.
 * دفاع في العمق بجانب فحص الاستيراد، لأن الحفظ هو آخر نقطة قبل قاعدة البيانات.
 */
export function checkPostableEntries(entries: ImportEntryDraft[]): PostingIssue[] {
  const issues: PostingIssue[] = [];
  for (const entry of entries) {
    const lines = entry.lines ?? [];
    if (lines.length < 2) {
      issues.push({
        entryNumber: entry.entryNumber,
        code: "TOO_FEW_LINES",
        message: `القيد ${entry.entryNumber} يحتوي ${lines.length} سطراً فقط.`,
      });
      continue;
    }
    for (const line of lines) {
      if (!line.accountCode?.trim()) {
        issues.push({
          entryNumber: entry.entryNumber,
          code: "LINE_WITHOUT_ACCOUNT",
          message: `القيد ${entry.entryNumber} يحتوي سطراً بلا حساب.`,
        });
      }
      const debit = dec(line.debit);
      const credit = dec(line.credit);
      if (debit.isNegative() || credit.isNegative()) {
        issues.push({
          entryNumber: entry.entryNumber,
          code: "NEGATIVE_AMOUNT",
          message: `القيد ${entry.entryNumber} يحتوي مبلغاً سالباً.`,
        });
      }
      if (debit.isZero() && credit.isZero()) {
        issues.push({
          entryNumber: entry.entryNumber,
          code: "ZERO_LINE",
          message: `القيد ${entry.entryNumber} يحتوي سطراً بمبلغ صفر.`,
        });
      }
      if (!debit.isZero() && !credit.isZero()) {
        issues.push({
          entryNumber: entry.entryNumber,
          code: "BOTH_SIDES",
          message: `القيد ${entry.entryNumber} يحتوي سطراً مديناً ودائناً في آن واحد.`,
        });
      }
    }
    const totals = entryTotals({ lines });
    if (!totals.balanced) {
      issues.push({
        entryNumber: entry.entryNumber,
        code: "UNBALANCED",
        message: `القيد ${entry.entryNumber} غير متوازن بفرق ${totals.difference.toFixed(2)}.`,
      });
    }
  }
  return issues;
}
