import Decimal from "decimal.js";
import { dec, money } from "./money";
import { entryTotals, filterEntries, listMonths } from "./engine";
import type { Account, AnomalyResult, DateRange, JournalEntry, Ledger, Severity } from "./types";

export interface AnomalyRules {
  /** نسبة الارتفاع مقارنة بالمتوسط الذي يُعتبر شاذاً. */
  expenseSpikeRatio: number;
  expenseSpikeMinAmount: number;
  /** عدد الانحرافات المعيارية لحد اعتبار القيمة متطرفة. */
  outlierStdFactor: number;
  repeatedAmountMinCount: number;
  repeatedAmountMinTotal: number;
  documentationThreshold: number;
  /** نسبة تركيز المصروف على حساب واحد. */
  concentrationShare: number;
  minHistoryMonths: number;
  minAmount: number;
}

export const DEFAULT_ANOMALY_RULES: AnomalyRules = {
  expenseSpikeRatio: 1.8,
  expenseSpikeMinAmount: 1000,
  outlierStdFactor: 3,
  repeatedAmountMinCount: 3,
  repeatedAmountMinTotal: 1000,
  documentationThreshold: 5000,
  concentrationShare: 40,
  minHistoryMonths: 3,
  minAmount: 100,
};

export interface AnomalyOptions extends DateRange {
  rules?: Partial<AnomalyRules>;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function severityFromScore(score: number): Severity {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function expenseLinesOf(entry: JournalEntry, accounts: Map<string, Account>) {
  const lines: Array<{ account: Account; amount: Decimal }> = [];
  for (const line of entry.lines) {
    const account = accounts.get(line.accountCode?.trim());
    if (!account || account.type !== "expense") continue;
    const amount = dec(line.debit).minus(line.credit);
    if (!amount.isZero()) lines.push({ account, amount });
  }
  return lines;
}

export function detectAnomalies(
  ledger: Pick<Ledger, "accounts" | "entries" | "currency">,
  options: AnomalyOptions = {},
): AnomalyResult[] {
  const rules: AnomalyRules = { ...DEFAULT_ANOMALY_RULES, ...options.rules };
  const to = options.to ?? new Date().toISOString().slice(0, 10);
  const from = options.from ?? `${to.slice(0, 4)}-01-01`;
  const accounts = new Map<string, Account>();
  for (const account of ledger.accounts) accounts.set(account.code.trim(), account);

  const entries = filterEntries(ledger.entries, { from, to });
  const results: AnomalyResult[] = [];
  const months = listMonths(from, to);

  const monthlyByAccount = new Map<string, Map<string, Decimal>>();
  const entriesByAccount = new Map<string, Array<{ entry: JournalEntry; amount: Decimal }>>();
  const totalExpensesByAccount = new Map<string, Decimal>();
  let grandTotal = new Decimal(0);

  for (const entry of entries) {
    for (const { account, amount } of expenseLinesOf(entry, accounts)) {
      const month = entry.date.slice(0, 7);
      const accountMap = monthlyByAccount.get(account.code) ?? new Map<string, Decimal>();
      accountMap.set(month, (accountMap.get(month) ?? new Decimal(0)).plus(amount));
      monthlyByAccount.set(account.code, accountMap);
      entriesByAccount.set(account.code, [...(entriesByAccount.get(account.code) ?? []), { entry, amount }]);
      totalExpensesByAccount.set(
        account.code,
        (totalExpensesByAccount.get(account.code) ?? new Decimal(0)).plus(amount),
      );
      grandTotal = grandTotal.plus(amount);
    }
  }

  for (const [code, monthMap] of monthlyByAccount) {
    const account = accounts.get(code);
    if (!account) continue;
    const values = months.map((m) => (monthMap.get(m) ?? new Decimal(0)).toNumber());
    const nonZero = values.filter((v) => v > 0);
    if (nonZero.length < rules.minHistoryMonths) continue;
    const mean = nonZero.reduce((s, v) => s + v, 0) / nonZero.length;
    const sd = stdDev(nonZero);
    const threshold = Math.max(mean * rules.expenseSpikeRatio, mean + 2 * sd, rules.expenseSpikeMinAmount);
    for (const [month, amountDec] of monthMap) {
      const amount = amountDec.toNumber();
      if (amount < threshold || amount < rules.minAmount) continue;
      const ratio = mean > 0 ? amount / mean : 0;
      const score = Math.min(95, 50 + Math.round((ratio - 1) * 25));
      results.push({
        id: `anomaly-spike-${code}-${month}`,
        title: "ارتفاع غير معتاد في مصروف",
        description: `مصروف الحساب ${code} - ${account.name} في شهر ${month} بلغ ${money(amount).toFixed(2)} مقابل متوسط ${money(mean).toFixed(2)}. هذه مؤشر للمراجعة وليست دليلاً على خطأ أو احتيال.`,
        category: "expense_spike",
        severity: severityFromScore(score),
        score,
        amount: money(amount),
        accountCode: code,
        accountName: account.name,
        period: month,
        reasons: [
          `المبلغ يتجاوز حد الارتفاع المحسوب (${money(threshold).toFixed(2)})`,
          `نسبة الارتفاع عن المتوسط ${Math.round(ratio * 100)}%`,
        ],
        evidence: [
          { label: "متوسط الأشهر", value: money(mean).toFixed(2) },
          { label: "الانحراف المعياري", value: money(sd).toFixed(2) },
          { label: "عدد الأشهر ذات النشاط", value: String(nonZero.length) },
        ],
      });
    }
  }

  for (const [code, list] of entriesByAccount) {
    if (list.length < 4) continue;
    const account = accounts.get(code);
    if (!account) continue;
    const values = list.map((item) => item.amount.toNumber());
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const sd = stdDev(values);
    if (sd === 0) continue;
    const threshold = mean + rules.outlierStdFactor * sd;
    for (const { entry, amount } of list) {
      const value = amount.toNumber();
      if (value < threshold || value < rules.minAmount) continue;
      const z = (value - mean) / sd;
      const score = Math.min(95, 45 + Math.round(z * 10));
      results.push({
        id: `anomaly-outlier-${code}-${entry.id}`,
        title: "معاملة بمبلغ متطرف",
        description: `عملية في القيد ${entry.entryNumber} على الحساب ${code} - ${account.name} بمبلغ ${money(value).toFixed(2)} تتجاوز ${rules.outlierStdFactor} انحراف معياري عن متوسط الحساب.`,
        category: "outlier",
        severity: severityFromScore(score),
        score,
        amount: money(value),
        accountCode: code,
        accountName: account.name,
        period: entry.date.slice(0, 7),
        reasons: [`الانحراف المعياري ${z.toFixed(1)}`, "المبلغ أعلى بكثير من المعتاد لهذا الحساب"],
        evidence: [
          { label: "رقم القيد", value: entry.entryNumber },
          { label: "تاريخ القيد", value: entry.date },
          { label: "متوسط الحساب", value: money(mean).toFixed(2) },
        ],
      });
    }
  }

  const amountCount = new Map<string, Array<{ entry: JournalEntry; code: string; amount: Decimal }>>();
  for (const entry of entries) {
    for (const { account, amount } of expenseLinesOf(entry, accounts)) {
      const key = money(amount).toFixed(2);
      amountCount.set(key, [...(amountCount.get(key) ?? []), { entry, code: account.code, amount }]);
    }
  }
  for (const [key, list] of amountCount) {
    if (list.length < rules.repeatedAmountMinCount) continue;
    const total = list.reduce((s, item) => s.plus(item.amount), new Decimal(0));
    if (total.lt(rules.repeatedAmountMinTotal)) continue;
    const score = Math.min(85, 45 + list.length * 8);
    results.push({
      id: `anomaly-repeated-${key}`,
      title: "مبلغ متكرر في عدة عمليات",
      description: `المبلغ ${key} تكرر ${list.length} مرات في مصروفات الفترة. التكرار قد يكون طبيعياً (إيجار شهري مثلاً) أو يستدعي مراجعة.`,
      category: "repeated_amount",
      severity: severityFromScore(score),
      score,
      amount: money(total),
      accountCode: list[0].code,
      accountName: accounts.get(list[0].code)?.name ?? null,
      period: null,
      reasons: [`عدد التكرار ${list.length}`, "نفس المبلغ على حسابات مصروفات"],
      evidence: list.slice(0, 5).map((item) => ({
        label: `قيد ${item.entry.entryNumber}`,
        value: `${item.entry.date} — ${money(item.amount).toFixed(2)}`,
      })),
    });
  }

  for (const entry of entries) {
    const amount = entryTotals(entry).debit;
    if (amount.lt(rules.documentationThreshold)) continue;
    if (entry.reference || entry.lines.some((l) => l.documentRef)) continue;
    const expense = expenseLinesOf(entry, accounts)[0];
    if (!expense) continue;
    results.push({
      id: `anomaly-doc-${entry.id}`,
      title: "مصروف كبير بدون مرجع مستند",
      description: `القيد ${entry.entryNumber} بمبلغ ${amount.toFixed(2)} على الحساب ${expense.account.code} لا يحتوي على رقم مستند أو فاتورة.`,
      category: "documentation",
      severity: "medium",
      score: 60,
      amount: money(amount),
      accountCode: expense.account.code,
      accountName: expense.account.name,
      period: entry.date.slice(0, 7),
      reasons: ["المبلغ يتجاوز حد المستندات المطلوبة", "لا يوجد مرجع أو رقم فاتورة"],
      evidence: [
        { label: "رقم القيد", value: entry.entryNumber },
        { label: "الحد المعتمد", value: money(rules.documentationThreshold).toFixed(2) },
      ],
    });
  }

  if (grandTotal.gt(0)) {
    for (const [code, amount] of totalExpensesByAccount) {
      const share = amount.div(grandTotal).times(100).toNumber();
      if (share < rules.concentrationShare) continue;
      const account = accounts.get(code);
      results.push({
        id: `anomaly-concentration-${code}`,
        title: "تركيز مرتفع للمصروفات",
        description: `الحساب ${code} - ${account?.name ?? code} يمثل ${share.toFixed(1)}% من إجمالي المصروفات في الفترة. التركيز ليس خطأً بحد ذاته لكنه يستدعي فهم طبيعة المصروف.`,
        category: "concentration",
        severity: share >= 70 ? "high" : "medium",
        score: Math.min(90, Math.round(share)),
        amount: money(amount),
        accountCode: code,
        accountName: account?.name ?? null,
        period: null,
        reasons: [`النسبة من إجمالي المصروفات ${share.toFixed(1)}%`],
        evidence: [{ label: "إجمالي المصروفات", value: money(grandTotal).toFixed(2) }],
      });
    }
  }

  const totalByMonth = new Map<string, number>();
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    const total = expenseLinesOf(entry, accounts).reduce((s, l) => s.plus(l.amount), new Decimal(0));
    if (total.isZero()) continue;
    totalByMonth.set(month, (totalByMonth.get(month) ?? 0) + total.toNumber());
  }
  for (let i = 1; i < months.length; i += 1) {
    const prev = totalByMonth.get(months[i - 1]) ?? 0;
    const current = totalByMonth.get(months[i]) ?? 0;
    if (prev <= 0 || current < rules.expenseSpikeMinAmount) continue;
    const change = (current - prev) / prev;
    if (change < rules.expenseSpikeRatio - 1) continue;
    const score = Math.min(88, 50 + Math.round(change * 20));
    results.push({
      id: `anomaly-ratio-${months[i]}`,
      title: "قفزة في إجمالي المصروفات بين شهرين",
      description: `ارتفع إجمالي المصروفات من ${money(prev).toFixed(2)} في ${months[i - 1]} إلى ${money(current).toFixed(2)} في ${months[i]} بنسبة ${Math.round(change * 100)}%.`,
      category: "ratio_shift",
      severity: severityFromScore(score),
      score,
      amount: money(current),
      period: months[i],
      reasons: [`نسبة التغير ${Math.round(change * 100)}%`],
      evidence: [
        { label: "الشهر السابق", value: money(prev).toFixed(2) },
        { label: "الشهر الحالي", value: money(current).toFixed(2) },
      ],
    });
  }

  const seen = new Set<string>();
  return results
    .filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .sort((a, b) => b.score - a.score);
}

export function summarizeAnomalies(anomalies: AnomalyResult[]): Record<Severity, number> {
  const result: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const item of anomalies) result[item.severity] += 1;
  return result;
}
