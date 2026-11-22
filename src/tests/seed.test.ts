import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildBalanceSheet, buildIncomeStatement } from "@/lib/accounting/statements";
import { buildTrialBalance } from "@/lib/accounting/engine";
import { detectAuditFindings } from "@/lib/accounting/findings";
import type { Ledger } from "@/lib/accounting/types";

const useRealStore = (process.env.RAKAZ_SEED_TARGET ?? process.env.MIZAN_SEED_TARGET) === "store";
process.env.RAKAZ_DATA_DIR = useRealStore
  ? path.join(process.cwd(), ".rakaz-data")
  : mkdtempSync(path.join(tmpdir(), "rakaz-seed-"));

describe("تهيئة بيانات العرض التجريبي", () => {
  it("ينشئ مخزن البيانات ويتحقق من سلامة الأرقام", async () => {
    const { resetStore, readStore } = await import("@/lib/data/store");
    await resetStore();
    const store = await readStore();

    expect(store.version).toBe(1);
    expect(store.companies).toHaveLength(3);
    expect(store.users.length).toBeGreaterThanOrEqual(4);

    for (const company of store.companies) {
      const data = store.data[company.id];
      expect(data, `بيانات ${company.name}`).toBeDefined();
      const ledger: Ledger = {
        accounts: data.accounts,
        entries: data.entries,
        periods: data.periods,
        currency: company.currency,
      };
      const trial = buildTrialBalance(ledger, {
        from: company.fiscalYearStart,
        to: company.fiscalYearEnd,
      });
      const income = buildIncomeStatement(ledger, {
        from: company.fiscalYearStart,
        to: company.fiscalYearEnd,
      });
      const balance = buildBalanceSheet(ledger, {
        from: company.fiscalYearStart,
        to: company.fiscalYearEnd,
        periodStart: company.fiscalYearStart,
      });
      const findings = detectAuditFindings(ledger, {
        from: company.fiscalYearStart,
        to: company.fiscalYearEnd,
      });

      console.log(
        [
          `• ${company.name} (${company.currency})`,
          `  قيود: ${data.entries.length}`,
          `  إيرادات: ${income.netRevenue.toFixed(2)}`,
          `  صافي الربح: ${income.netProfit.toFixed(2)}`,
          `  أصول: ${balance.totalAssets.toFixed(2)}`,
          `  ميزان متوازن: ${trial.balanced ? "نعم" : "لا"}`,
          `  مركز مالي متوازن: ${balance.balanced ? "نعم" : "لا"}`,
          `  ملاحظات: ${findings.length}`,
        ].join("\n"),
      );

      expect(trial.entryCount).toBeGreaterThan(0);
      expect(Number.isFinite(income.netProfit)).toBe(true);
      if (company.id !== "co-rakaz") {
        expect(trial.balanced, `${company.name} ميزان`).toBe(true);
        expect(balance.balanced, `${company.name} مركز مالي`).toBe(true);
      }
    }
  });
});
