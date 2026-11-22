import { buildTrialBalance } from "@/lib/accounting/engine";
import { buildBalanceSheet, buildIncomeStatement } from "@/lib/accounting/statements";
import { buildFinancialAnalysis } from "@/lib/accounting/ratios";
import { detectAuditFindings } from "@/lib/accounting/findings";
import { detectDuplicates } from "@/lib/accounting/duplicates";
import { detectAnomalies } from "@/lib/accounting/anomalies";
import { formatMoney } from "@/lib/accounting/money";
import type { Ledger } from "@/lib/accounting/types";
import type { Company, CompanyData } from "@/lib/data/types";

export interface AssistantContext {
  company: {
    name: string;
    legalName: string;
    activityType: string;
    currency: string;
    period: { from: string; to: string };
  };
  totals: {
    netRevenue: number;
    grossProfit: number;
    operatingExpenses: number;
    netProfit: number;
    netMargin: number;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    cash: number;
    bank: number;
    receivables: number;
    inventory: number;
    currentAssets: number;
    currentLiabilities: number;
  };
  trial: { balanced: boolean; difference: number; entryCount: number };
  monthly: Array<{ period: string; revenue: number; expenses: number; profit: number }>;
  changes: { revenue: number | null; expenses: number | null; profit: number | null };
  topExpenses: Array<{ name: string; amount: number; share: number }>;
  ratios: Array<{ label: string; value: number | null; unit: string; available: boolean; formula: string }>;
  findings: Array<{
    title: string;
    severity: string;
    description: string;
    recommendation: string;
    accountCode: string | null;
    entryNumber: string | null;
    amount: number | null;
  }>;
  duplicates: Array<{
    kind: string;
    strength: string;
    score: number;
    entries: string[];
    reasons: string[];
    recommendation: string;
  }>;
  anomalies: Array<{ title: string; severity: string; amount: number; reasons: string[] }>;
  sources: string[];
}

export function buildAssistantContext({
  company,
  data,
  ledger,
  period,
}: {
  company: Company;
  data: CompanyData;
  ledger: Ledger;
  period: { from: string; to: string };
}): AssistantContext {
  const income = buildIncomeStatement(ledger, period);
  const balance = buildBalanceSheet(ledger, { ...period, periodStart: period.from });
  const analysis = buildFinancialAnalysis(ledger, period);
  const trial = buildTrialBalance(ledger, period);
  const findings = detectAuditFindings(ledger, period);
  const duplicates = detectDuplicates(ledger, period);
  const anomalies = detectAnomalies(ledger, period);

  return {
    company: {
      name: company.name,
      legalName: company.legalName,
      activityType: company.activityType,
      currency: company.currency,
      period,
    },
    totals: {
      netRevenue: income.netRevenue,
      grossProfit: income.grossProfit,
      operatingExpenses: income.operatingExpenses,
      netProfit: income.netProfit,
      netMargin: income.netRevenue > 0 ? (income.netProfit / income.netRevenue) * 100 : 0,
      totalAssets: balance.totalAssets,
      totalLiabilities: balance.totalLiabilities,
      totalEquity: balance.totalEquity,
      cash: balance.cash,
      bank: balance.bank,
      receivables: balance.receivables,
      inventory: balance.inventory,
      currentAssets: balance.totalCurrentAssets,
      currentLiabilities: balance.totalCurrentLiabilities,
    },
    trial: { balanced: trial.balanced, difference: trial.difference, entryCount: trial.entryCount },
    monthly: analysis.monthly,
    changes: {
      revenue: analysis.revenueChange,
      expenses: analysis.expenseChange,
      profit: analysis.profitChange,
    },
    topExpenses: analysis.expenseBreakdown.slice(0, 6).map((item) => ({
      name: item.name,
      amount: item.amount,
      share: item.share,
    })),
    ratios: analysis.ratios.map((ratio) => ({
      label: ratio.label,
      value: ratio.value,
      unit: ratio.unit,
      available: ratio.available,
      formula: ratio.formula,
    })),
    findings: findings.slice(0, 15).map((finding) => ({
      title: finding.title,
      severity: finding.severity,
      description: finding.description,
      recommendation: finding.recommendation,
      accountCode: finding.accountCode ?? null,
      entryNumber: finding.entryNumber ?? null,
      amount: finding.amount ?? null,
    })),
    duplicates: duplicates.slice(0, 10).map((group) => ({
      kind: group.kind,
      strength: group.strength,
      score: group.score,
      entries: group.entries.map((entry) => `${entry.entryNumber} (${entry.date.slice(0, 10)})`),
      reasons: group.reasons,
      recommendation: group.recommendation,
    })),
    anomalies: anomalies.slice(0, 10).map((anomaly) => ({
      title: anomaly.title,
      severity: anomaly.severity,
      amount: anomaly.amount,
      reasons: anomaly.reasons,
    })),
    sources: [
      `قيود مرحّلة: ${trial.entryCount}`,
      `حسابات: ${data.accounts.length}`,
      `ملفات مستوردة: ${data.batches.length}`,
      `الفترة: ${period.from} — ${period.to}`,
    ],
  };
}

export function formatContextForPrompt(context: AssistantContext): string {
  return JSON.stringify(
    {
      ...context,
      formatted: {
        netRevenue: formatMoney(context.totals.netRevenue, context.company.currency),
        netProfit: formatMoney(context.totals.netProfit, context.company.currency),
        totalAssets: formatMoney(context.totals.totalAssets, context.company.currency),
        totalLiabilities: formatMoney(context.totals.totalLiabilities, context.company.currency),
        totalEquity: formatMoney(context.totals.totalEquity, context.company.currency),
        cashAndBank: formatMoney(context.totals.cash + context.totals.bank, context.company.currency),
        currentAssets: formatMoney(context.totals.currentAssets, context.company.currency),
        currentLiabilities: formatMoney(context.totals.currentLiabilities, context.company.currency),
      },
    },
    null,
    2,
  );
}
