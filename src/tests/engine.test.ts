import { describe, expect, it } from "vitest";
import {
  accountBalancesAt,
  buildTrialBalance,
  entryTotals,
  isEntryBalanced,
  previousPeriod,
  validateEntry,
} from "@/lib/accounting/engine";
import { testAccounts, testLedger, unbalancedEntry, unknownAccountEntry } from "./fixtures";

describe("توازن القيود", () => {
  it("يكتشف القيد المتوازن", () => {
    expect(isEntryBalanced(testLedger.entries[0])).toBe(true);
    expect(entryTotals(testLedger.entries[0]).difference.toNumber()).toBe(0);
  });

  it("يكتشف القيد غير المتوازن", () => {
    expect(isEntryBalanced(unbalancedEntry)).toBe(false);
    expect(entryTotals(unbalancedEntry).difference.toNumber()).toBe(100);
  });

  it("يعطي أخطاء واضحة عند التحقق من قيد غير متوازن", () => {
    const issues = validateEntry(unbalancedEntry, testAccounts);
    expect(issues.map((i) => i.code)).toContain("UNBALANCED");
  });

  it("يكتشف الحسابات غير الموجودة", () => {
    const issues = validateEntry(unknownAccountEntry, testAccounts);
    expect(issues.map((i) => i.code)).toContain("UNKNOWN_ACCOUNT");
  });
});

describe("ميزان المراجعة", () => {
  const trial = buildTrialBalance(testLedger, { from: "2025-01-01", to: "2025-12-31" });

  it("يكون متوازناً", () => {
    expect(trial.balanced).toBe(true);
    expect(trial.difference).toBe(0);
    expect(trial.totals.debit).toBeCloseTo(trial.totals.credit, 2);
    expect(trial.totals.closingDebit).toBeCloseTo(trial.totals.closingCredit, 2);
  });

  it("يحسب أرصدة الحسابات بشكل صحيح", () => {
    const byCode = new Map(trial.rows.map((row) => [row.code, row]));
    expect(byCode.get("1010")?.closingDebit).toBe(93000);
    expect(byCode.get("1030")?.closingDebit).toBe(30000);
    expect(byCode.get("1040")?.closingDebit).toBe(118000);
    expect(byCode.get("1220")?.closingCredit).toBe(50000);
    expect(byCode.get("2010")?.closingCredit).toBe(50000);
    expect(byCode.get("2020")?.closingCredit).toBe(4000);
    expect(byCode.get("3010")?.closingCredit).toBe(250000);
    expect(byCode.get("3020")?.closingCredit).toBe(100000);
    expect(byCode.get("4010")?.closingCredit).toBe(120000);
    expect(byCode.get("5010")?.closingDebit).toBe(72000);
  });

  it("يفصل حركة الفترة عن الأرصدة الافتتاحية", () => {
    const q1 = buildTrialBalance(testLedger, { from: "2025-01-01", to: "2025-03-31" });
    const cash = q1.rows.find((row) => row.code === "1010");
    expect(cash?.openingDebit).toBe(100000);
    expect(cash?.debit).toBe(90000);
    expect(cash?.credit).toBe(42000);
    expect(cash?.closingDebit).toBe(148000);
  });

  it("يحسب الأرصدة حتى تاريخ محدد", () => {
    const balances = accountBalancesAt(testLedger, "2025-02-01");
    expect(balances.get("1030")?.net.toNumber()).toBe(30000);
    expect(balances.get("1010")?.net.toNumber()).toBe(190000);
  });

  it("يستبعد القيود غير المرحّلة", () => {
    const draft = {
      ...testLedger,
      entries: [
        ...testLedger.entries,
        {
          id: "draft",
          entryNumber: "D-1",
          date: "2025-04-01",
          description: "مسودة",
          source: "manual",
          status: "draft" as const,
          lines: [
            { accountCode: "1010", debit: 999999, credit: 0 },
            { accountCode: "4010", debit: 0, credit: 999999 },
          ],
        },
      ],
    };
    const trialWithDraft = buildTrialBalance(draft, { from: "2025-01-01", to: "2025-12-31" });
    const cash = trialWithDraft.rows.find((row) => row.code === "1010");
    expect(cash?.closingDebit).toBe(93000);
  });
});

describe("الفترات", () => {
  it("يحسب الفترة السابقة بنفس الطول", () => {
    expect(previousPeriod({ from: "2025-02-01", to: "2025-02-28" })).toEqual({
      from: "2025-01-04",
      to: "2025-01-31",
    });
  });
});
