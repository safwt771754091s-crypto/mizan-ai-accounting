import Decimal from "decimal.js";
import { dec, money, round2 } from "./money";
import { entryTotals, filterEntries } from "./engine";
import { bestTextSimilarity, normalizeArabic } from "../utils/similarity";
import type { DateRange, DuplicateGroup, JournalEntry, Ledger } from "./types";

export interface DuplicateOptions extends DateRange {
  dateWindowDays?: number;
  minScore?: number;
  amountTolerance?: number;
  descriptionThreshold?: number;
}

interface Candidate {
  a: JournalEntry;
  b: JournalEntry;
  score: number;
  reasons: string[];
}

function accountsKey(entry: JournalEntry): string {
  return [...new Set(entry.lines.map((l) => l.accountCode?.trim()).filter(Boolean))].sort().join("|");
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const db = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) return Number.POSITIVE_INFINITY;
  return Math.abs(da - db) / 86400000;
}

function entryText(entry: JournalEntry): string {
  return `${entry.description} ${entry.lines.map((l) => l.description ?? "").join(" ")}`.trim();
}

function scorePair(
  a: JournalEntry,
  b: JournalEntry,
  options: Required<Omit<DuplicateOptions, "from" | "to">>,
): Candidate | null {
  const reasons: string[] = [];
  let score = 0;

  const amountA = entryTotals(a).debit;
  const amountB = entryTotals(b).debit;
  const amountDiff = amountA.minus(amountB).abs();
  const tolerance = dec(options.amountTolerance);
  if (amountDiff.lte(tolerance) && amountA.gt(0)) {
    score += 25;
    reasons.push("المبلغ متطابق");
  } else if (amountDiff.lte(tolerance.plus(1))) {
    score += 10;
    reasons.push("فرق بسيط في المبلغ");
  }

  const refA = a.reference?.trim() ?? "";
  const refB = b.reference?.trim() ?? "";
  if (refA && refB) {
    if (normalizeArabic(refA) === normalizeArabic(refB)) {
      score += 45;
      reasons.push("رقم المستند/الفاتورة متطابق");
    } else {
      score -= 10;
    }
  }

  const dayDiff = daysBetween(a.date, b.date);
  if (dayDiff === 0) {
    score += 15;
    reasons.push("نفس التاريخ");
  } else if (dayDiff <= options.dateWindowDays) {
    score += 8;
    reasons.push(`التاريخان متقاربان (${dayDiff} يوم)`);
  }

  const textScore = bestTextSimilarity(entryText(a), entryText(b));
  if (textScore >= options.descriptionThreshold) {
    score += Math.round(textScore * 20);
    reasons.push(`تشابه الوصف بنسبة ${Math.round(textScore * 100)}%`);
  }

  if (accountsKey(a) && accountsKey(a) === accountsKey(b)) {
    score += 10;
    reasons.push("نفس الحسابات المستخدمة");
  }
  if (a.source && a.source === b.source) {
    score += 5;
    reasons.push("نفس مصدر العملية");
  }

  if (score < options.minScore) return null;
  return { a, b, score: Math.min(100, score), reasons };
}

function inferKind(entry: JournalEntry): DuplicateGroup["kind"] {
  const text = normalizeArabic(`${entry.source} ${entry.description}`);
  if (/فاتوره|invoice/.test(text)) return "invoice";
  if (/سند|voucher/.test(text)) return "voucher";
  if (/شراء|purchase/.test(text)) return "purchase";
  if (/بيع|sale/.test(text)) return "sale";
  if (/مصروف|expense/.test(text)) return "expense";
  return "journal_entry";
}

function strengthOf(score: number): DuplicateGroup["strength"] {
  if (score >= 80) return "strong";
  if (score >= 65) return "medium";
  return "weak";
}

class UnionFind {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

export function detectDuplicates(
  ledger: Pick<Ledger, "entries">,
  options: DuplicateOptions = {},
): DuplicateGroup[] {
  const config: Required<Omit<DuplicateOptions, "from" | "to">> = {
    dateWindowDays: options.dateWindowDays ?? 3,
    minScore: options.minScore ?? 50,
    amountTolerance: options.amountTolerance ?? 0.01,
    descriptionThreshold: options.descriptionThreshold ?? 0.6,
  };

  const entries = filterEntries(ledger.entries, { from: options.from, to: options.to })
    .filter((e) => entryTotals(e).debit.gt(0))
    .sort((a, b) => a.date.localeCompare(b.date));

  const pairs: Candidate[] = [];
  const amountBuckets = new Map<string, number[]>();
  const refBuckets = new Map<string, number[]>();
  const dayBuckets = new Map<string, number[]>();

  entries.forEach((entry, index) => {
    const amount = entryTotals(entry).debit;
    const bucket = round2(amount).toFixed(0);
    amountBuckets.set(bucket, [...(amountBuckets.get(bucket) ?? []), index]);
    if (entry.reference?.trim()) {
      const key = normalizeArabic(entry.reference);
      refBuckets.set(key, [...(refBuckets.get(key) ?? []), index]);
    }
    const day = entry.date.slice(0, 10);
    dayBuckets.set(day, [...(dayBuckets.get(day) ?? []), index]);
  });

  const seen = new Set<string>();
  const compareIndexes = (indexes: number[]) => {
    for (let i = 0; i < indexes.length; i += 1) {
      for (let j = i + 1; j < indexes.length; j += 1) {
        const ia = indexes[i];
        const ib = indexes[j];
        const key = ia < ib ? `${ia}:${ib}` : `${ib}:${ia}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const candidate = scorePair(entries[ia], entries[ib], config);
        if (candidate) pairs.push(candidate);
      }
    }
  };

  for (const indexes of amountBuckets.values()) compareIndexes(indexes);
  for (const indexes of refBuckets.values()) compareIndexes(indexes);
  for (const indexes of dayBuckets.values()) compareIndexes(indexes);

  const sortedBuckets = [...amountBuckets.keys()].map(Number).sort((a, b) => a - b);
  for (let i = 0; i < sortedBuckets.length - 1; i += 1) {
    if (Math.abs(sortedBuckets[i + 1] - sortedBuckets[i]) <= 1) {
      compareIndexes([
        ...(amountBuckets.get(String(sortedBuckets[i])) ?? []),
        ...(amountBuckets.get(String(sortedBuckets[i + 1])) ?? []),
      ]);
    }
  }

  const uf = new UnionFind(entries.length);
  for (const pair of pairs) {
    const ia = entries.indexOf(pair.a);
    const ib = entries.indexOf(pair.b);
    if (ia >= 0 && ib >= 0) uf.union(ia, ib);
  }

  const groups = new Map<number, Candidate[]>();
  for (const pair of pairs) {
    const root = uf.find(entries.indexOf(pair.a));
    groups.set(root, [...(groups.get(root) ?? []), pair]);
  }

  const result: DuplicateGroup[] = [];
  for (const [root, groupPairs] of groups) {
    const memberIndexes = new Set<number>([root]);
    for (const pair of groupPairs) {
      memberIndexes.add(uf.find(entries.indexOf(pair.a)));
      memberIndexes.add(entries.indexOf(pair.a));
      memberIndexes.add(entries.indexOf(pair.b));
    }
    const members = [...memberIndexes]
      .filter((i) => uf.find(i) === root)
      .map((i) => entries[i])
      .filter(Boolean);
    if (members.length < 2) continue;

    const maxScore = Math.max(...groupPairs.map((p) => p.score));
    const reasons = [...new Set(groupPairs.flatMap((p) => p.reasons))];

    result.push({
      id: `dup-${members.map((m) => m.id).sort().join("-")}`,
      kind: inferKind(members[0]),
      strength: strengthOf(maxScore),
      score: maxScore,
      entries: members.map((entry) => ({
        entryId: entry.id,
        entryNumber: entry.entryNumber,
        date: entry.date,
        description: entry.description,
        amount: money(entryTotals(entry).debit),
        reference: entry.reference ?? null,
        supplier: null,
      })),
      reasons,
      recommendation:
        "هذه عملية اشتباه آلية وليست إثباتاً للتكرار. راجع المستندات الأصلية قبل أي إجراء، ولا تحذف أو تعدّل القيود تلقائياً.",
    });
  }

  const byReference = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    const ref = entry.reference?.trim();
    if (!ref) continue;
    const key = normalizeArabic(ref);
    byReference.set(key, [...(byReference.get(key) ?? []), entry]);
  }
  for (const [ref, group] of byReference) {
    if (group.length < 2) continue;
    const alreadyCovered = result.some((g) => group.every((e) => g.entries.some((ge) => ge.entryId === e.id)));
    if (alreadyCovered) continue;
    const amounts = new Set(group.map((e) => money(entryTotals(e).debit).toFixed(2)));
    if (amounts.size <= 1) continue;
    result.push({
      id: `dup-ref-${ref.replace(/\s+/g, "-")}`,
      kind: inferKind(group[0]),
      strength: "medium",
      score: 70,
      entries: group.map((entry) => ({
        entryId: entry.id,
        entryNumber: entry.entryNumber,
        date: entry.date,
        description: entry.description,
        amount: money(entryTotals(entry).debit),
        reference: entry.reference ?? null,
        supplier: null,
      })),
      reasons: ["نفس رقم المستند/الفاتورة مستخدم في أكثر من عملية بمبالغ مختلفة"],
      recommendation:
        "تحقق من أن رقم الفاتورة لم يُستخدم مرتين، أو أن العملية مقسمة على عدة قيود بشكل صحيح. لا تعدّل القيود تلقائياً.",
    });
  }

  return result.sort((a, b) => b.score - a.score);
}

export function duplicateAmount(group: DuplicateGroup): number {
  return group.entries.reduce((sum, entry) => sum + entry.amount, 0);
}

export function duplicateCurrencyCheck(group: DuplicateGroup, tolerance = 0.01): boolean {
  const first = group.entries[0]?.amount ?? 0;
  return group.entries.every((entry) => Math.abs(entry.amount - first) <= tolerance);
}

export function totalDuplicateExposure(groups: DuplicateGroup[]): number {
  return groups.reduce((sum, group) => {
    if (group.entries.length < 2) return sum;
    const sorted = [...group.entries].sort((a, b) => b.amount - a.amount);
    const excess = new Decimal(sorted[0].amount).times(sorted.length - 1);
    return sum + excess.toNumber();
  }, 0);
}
