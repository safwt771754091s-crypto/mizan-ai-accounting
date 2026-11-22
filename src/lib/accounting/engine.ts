import Decimal from "decimal.js";
import { dec, money, round2 } from "./money";
import { normalBalanceOf } from "./accounts";
import type {
  Account,
  DateRange,
  JournalEntry,
  JournalEntryLine,
  Ledger,
  TrialBalance,
  TrialBalanceRow,
} from "./types";

export const BALANCE_TOLERANCE = new Decimal("0.01");

export interface EntryTotals {
  debit: Decimal;
  credit: Decimal;
  difference: Decimal;
  balanced: boolean;
}

export function entryTotals(entry: Pick<JournalEntry, "lines">): EntryTotals {
  let debit = new Decimal(0);
  let credit = new Decimal(0);
  for (const line of entry.lines ?? []) {
    debit = debit.plus(dec(line.debit));
    credit = credit.plus(dec(line.credit));
  }
  const difference = debit.minus(credit);
  return {
    debit: round2(debit),
    credit: round2(credit),
    difference: round2(difference),
    balanced: difference.abs().lte(BALANCE_TOLERANCE),
  };
}

export function isEntryBalanced(entry: Pick<JournalEntry, "lines">): boolean {
  return entryTotals(entry).balanced;
}

export function entryAmount(entry: Pick<JournalEntry, "lines">): Decimal {
  return round2(entryTotals(entry).debit);
}

export interface EntryValidationIssue {
  code: string;
  message: string;
  severity: "critical" | "high" | "medium" | "low";
}

export function validateEntry(entry: JournalEntry, accounts?: Account[]): EntryValidationIssue[] {
  const issues: EntryValidationIssue[] = [];
  const totals = entryTotals(entry);
  if (!entry.lines || entry.lines.length === 0) {
    issues.push({ code: "NO_LINES", message: "القيد لا يحتوي على أي سطور", severity: "critical" });
    return issues;
  }
  if (!totals.balanced) {
    issues.push({
      code: "UNBALANCED",
      message: `القيد غير متوازن بفرق ${totals.difference.toFixed(2)}`,
      severity: "critical",
    });
  }
  if (entry.lines.length < 2) {
    issues.push({ code: "SINGLE_LINE", message: "القيد يحتوي على سطر واحد فقط", severity: "high" });
  }
  if (!entry.date || Number.isNaN(Date.parse(entry.date))) {
    issues.push({ code: "INVALID_DATE", message: "تاريخ القيد مفقود أو غير صالح", severity: "high" });
  }
  if (!entry.description || entry.description.trim().length < 3) {
    issues.push({ code: "MISSING_DESCRIPTION", message: "وصف القيد مفقود أو قصير جداً", severity: "medium" });
  }
  const codes = new Set((accounts ?? []).map((a) => a.code.trim()));
  for (const line of entry.lines) {
    const hasDebit = !dec(line.debit).isZero();
    const hasCredit = !dec(line.credit).isZero();
    if (hasDebit && hasCredit) {
      issues.push({ code: "BOTH_SIDES", message: `السطر على الحساب ${line.accountCode} يحتوي مديناً ودائناً معاً`, severity: "high" });
    }
    if (!hasDebit && !hasCredit) {
      issues.push({ code: "ZERO_LINE", message: `السطر على الحساب ${line.accountCode} بمبلغ صفر`, severity: "low" });
    }
    if (dec(line.debit).isNegative() || dec(line.credit).isNegative()) {
      issues.push({ code: "NEGATIVE_AMOUNT", message: `السطر على الحساب ${line.accountCode} يحتوي مبلغاً سالباً`, severity: "high" });
    }
    if (accounts && accounts.length > 0 && !codes.has(line.accountCode?.trim())) {
      issues.push({ code: "UNKNOWN_ACCOUNT", message: `الحساب ${line.accountCode} غير موجود في دليل الحسابات`, severity: "high" });
    }
  }
  return issues;
}

export interface EntryFilterOptions {
  from?: string;
  to?: string;
  includeDraft?: boolean;
  includeVoid?: boolean;
}

export function filterEntries(entries: JournalEntry[], options: EntryFilterOptions = {}): JournalEntry[] {
  const { from, to, includeDraft = false, includeVoid = false } = options;
  return entries.filter((entry) => {
    if (!includeVoid && entry.status === "void") return false;
    if (!includeDraft && entry.status === "draft") return false;
    const day = entry.date?.slice(0, 10);
    if (!day) return false;
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
}

export interface AccountMovement {
  account: Account | null;
  code: string;
  openingDebit: Decimal;
  openingCredit: Decimal;
  debit: Decimal;
  credit: Decimal;
}

export interface MovementResult {
  movements: Map<string, AccountMovement>;
  unknownAccounts: string[];
  unbalancedEntries: JournalEntry[];
  entryCount: number;
}

function emptyMovement(code: string, account: Account | null): AccountMovement {
  return {
    account,
    code,
    openingDebit: new Decimal(0),
    openingCredit: new Decimal(0),
    debit: new Decimal(0),
    credit: new Decimal(0),
  };
}

export function computeMovements(
  ledger: Pick<Ledger, "accounts" | "entries">,
  range: DateRange = {},
): MovementResult {
  const byCode = new Map<string, Account>();
  for (const account of ledger.accounts) byCode.set(account.code.trim(), account);

  const movements = new Map<string, AccountMovement>();
  const unknown = new Set<string>();
  const unbalanced: JournalEntry[] = [];

  const touch = (code: string): AccountMovement => {
    let m = movements.get(code);
    if (!m) {
      const account = byCode.get(code) ?? null;
      if (!account) unknown.add(code);
      m = emptyMovement(code, account);
      movements.set(code, m);
    }
    return m;
  };

  // الأرصدة الافتتاحية من دليل الحسابات تُعامل كرصيد ما قبل بداية الفترة.
  for (const account of ledger.accounts) {
    const opening = dec(account.openingBalance ?? 0);
    if (opening.isZero()) continue;
    const m = touch(account.code.trim());
    const side = account.openingBalanceType ?? normalBalanceOf(account);
    if (side === "debit") m.openingDebit = m.openingDebit.plus(opening);
    else m.openingCredit = m.openingCredit.plus(opening);
  }

  const entries = filterEntries(ledger.entries, { includeDraft: false, includeVoid: false });
  let counted = 0;
  for (const entry of entries) {
    const totals = entryTotals(entry);
    if (!totals.balanced) unbalanced.push(entry);
    const day = entry.date.slice(0, 10);
    const beforeRange = Boolean(range.from && day < range.from);
    const afterRange = Boolean(range.to && day > range.to);
    if (afterRange) continue;
    counted += 1;
    for (const line of entry.lines) {
      const code = line.accountCode?.trim();
      if (!code) continue;
      const m = touch(code);
      const debit = dec(line.debit);
      const credit = dec(line.credit);
      if (beforeRange) {
        m.openingDebit = m.openingDebit.plus(debit);
        m.openingCredit = m.openingCredit.plus(credit);
      } else {
        m.debit = m.debit.plus(debit);
        m.credit = m.credit.plus(credit);
      }
    }
  }

  return { movements, unknownAccounts: [...unknown], unbalancedEntries: unbalanced, entryCount: counted };
}

export function buildTrialBalance(
  ledger: Pick<Ledger, "accounts" | "entries">,
  range: DateRange = {},
  options: { includeZero?: boolean } = {},
): TrialBalance {
  const { movements, unknownAccounts, unbalancedEntries, entryCount } = computeMovements(ledger, range);
  const rows: TrialBalanceRow[] = [];

  for (const m of movements.values()) {
    const openingNet = m.openingDebit.minus(m.openingCredit);
    const closingNet = openingNet.plus(m.debit).plus(m.credit.negated());
    const hasActivity =
      !m.openingDebit.isZero() || !m.openingCredit.isZero() || !m.debit.isZero() || !m.credit.isZero();
    if (!hasActivity && !options.includeZero) continue;
    const account = m.account;
    rows.push({
      accountId: account?.id ?? `unknown:${m.code}`,
      code: m.code,
      name: account?.name ?? `حساب غير معرّف (${m.code})`,
      type: account?.type ?? "asset",
      subtype: account?.subtype ?? "other_asset",
      openingDebit: money(m.openingDebit),
      openingCredit: money(m.openingCredit),
      debit: money(m.debit),
      credit: money(m.credit),
      closingDebit: money(closingNet.isPositive() ? closingNet : 0),
      closingCredit: money(closingNet.isNegative() ? closingNet.negated() : 0),
      netBalance: money(closingNet),
      netBalanceSide: closingNet.isZero() ? "zero" : closingNet.isPositive() ? "debit" : "credit",
    });
  }

  rows.sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));

  const totals = rows.reduce(
    (acc, row) => ({
      openingDebit: acc.openingDebit.plus(row.openingDebit),
      openingCredit: acc.openingCredit.plus(row.openingCredit),
      debit: acc.debit.plus(row.debit),
      credit: acc.credit.plus(row.credit),
      closingDebit: acc.closingDebit.plus(row.closingDebit),
      closingCredit: acc.closingCredit.plus(row.closingCredit),
    }),
    {
      openingDebit: new Decimal(0),
      openingCredit: new Decimal(0),
      debit: new Decimal(0),
      credit: new Decimal(0),
      closingDebit: new Decimal(0),
      closingCredit: new Decimal(0),
    },
  );

  const difference = round2(totals.closingDebit.minus(totals.closingCredit));

  return {
    rows,
    totals: {
      openingDebit: money(totals.openingDebit),
      openingCredit: money(totals.openingCredit),
      debit: money(totals.debit),
      credit: money(totals.credit),
      closingDebit: money(totals.closingDebit),
      closingCredit: money(totals.closingCredit),
    },
    balanced: difference.abs().lte(BALANCE_TOLERANCE) && unbalancedEntries.length === 0,
    difference: money(difference),
    from: range.from,
    to: range.to,
    entryCount,
    unknownAccounts,
  } as TrialBalance;
}

export interface AccountBalance {
  code: string;
  debit: Decimal;
  credit: Decimal;
  /** الرصيد الصافي: مدين موجب، دائن سالب */
  net: Decimal;
}

export function accountBalancesAt(
  ledger: Pick<Ledger, "accounts" | "entries">,
  asOf: string,
): Map<string, AccountBalance> {
  const { movements } = computeMovements(ledger, { to: asOf });
  const result = new Map<string, AccountBalance>();
  for (const m of movements.values()) {
    const debit = m.openingDebit.plus(m.debit);
    const credit = m.openingCredit.plus(m.credit);
    result.set(m.code, { code: m.code, debit, credit, net: debit.minus(credit) });
  }
  return result;
}

/** المبلغ كما يُعرض في القوائم: موجب في الاتجاه الطبيعي للحساب. */
export function presentationAmount(account: Account, net: Decimal): Decimal {
  const debitPositive = account.type === "asset" || account.type === "expense";
  return debitPositive ? net : net.negated();
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function startOfYear(date: string): string {
  return `${date.slice(0, 4)}-01-01`;
}

export function previousPeriod(range: Required<Pick<DateRange, "from" | "to">>): { from: string; to: string } {
  const from = new Date(`${range.from}T00:00:00Z`);
  const to = new Date(`${range.to}T00:00:00Z`);
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const prevTo = addDays(range.from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { from: prevFrom, to: prevTo };
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function listMonths(from: string, to: string): string[] {
  const months: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const endYear = Number(to.slice(0, 4));
  const endMonth = Number(to.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export function lineAmount(line: JournalEntryLine): Decimal {
  return dec(line.debit).minus(dec(line.credit));
}

export function inRange(date: string, range: DateRange): boolean {
  const day = date.slice(0, 10);
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}
