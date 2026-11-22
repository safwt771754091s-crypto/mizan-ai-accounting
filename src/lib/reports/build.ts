import type { AnomalyResult, AuditFinding, DuplicateGroup, Ledger } from "@/lib/accounting/types";
import { buildTrialBalance } from "@/lib/accounting/engine";
import {
  buildBalanceSheet,
  buildCashFlowStatement,
  buildEquityStatement,
  buildIncomeStatement,
} from "@/lib/accounting/statements";
import { buildFinancialAnalysis } from "@/lib/accounting/ratios";
import { detectAuditFindings } from "@/lib/accounting/findings";
import { detectDuplicates } from "@/lib/accounting/duplicates";
import { detectAnomalies } from "@/lib/accounting/anomalies";
import type { Company, CompanyData } from "@/lib/data/types";
import { formatMoney } from "@/lib/accounting/money";

export interface ReportData {
  company: Company;
  period: { from: string; to: string };
  generatedAt: string;
  trial: ReturnType<typeof buildTrialBalance>;
  income: ReturnType<typeof buildIncomeStatement>;
  balance: ReturnType<typeof buildBalanceSheet>;
  cashFlow: ReturnType<typeof buildCashFlowStatement>;
  equity: ReturnType<typeof buildEquityStatement>;
  analysis: ReturnType<typeof buildFinancialAnalysis>;
  findings: AuditFinding[];
  duplicates: DuplicateGroup[];
  anomalies: AnomalyResult[];
  kpis: Array<{ label: string; value: string; hint?: string }>;
  executiveSummary: string[];
  recommendations: string[];
  sources: string[];
  limitations: string[];
}

export function buildReportData({
  company,
  data,
  ledger,
  period,
}: {
  company: Company;
  data: CompanyData;
  ledger: Ledger;
  period: { from: string; to: string };
}): ReportData {
  const trial = buildTrialBalance(ledger, period);
  const income = buildIncomeStatement(ledger, period);
  const balance = buildBalanceSheet(ledger, { ...period, periodStart: period.from });
  const cashFlow = buildCashFlowStatement(ledger, period);
  const equity = buildEquityStatement(ledger, period);
  const analysis = buildFinancialAnalysis(ledger, period);
  const findings = detectAuditFindings(ledger, period);
  const duplicates = detectDuplicates(ledger, period);
  const anomalies = detectAnomalies(ledger, period);

  const currency = company.currency;
  const grossMargin = income.netRevenue > 0 ? (income.grossProfit / income.netRevenue) * 100 : 0;
  const netMargin = income.netRevenue > 0 ? (income.netProfit / income.netRevenue) * 100 : 0;
  const currentRatio =
    balance.totalCurrentLiabilities > 0 ? balance.totalCurrentAssets / balance.totalCurrentLiabilities : null;

  const kpis = [
    { label: "صافي الإيرادات", value: formatMoney(income.netRevenue, currency), hint: `${period.from} — ${period.to}` },
    { label: "مجمل الربح", value: formatMoney(income.grossProfit, currency), hint: `هامش ${grossMargin.toFixed(1)}%` },
    { label: "صافي الربح", value: formatMoney(income.netProfit, currency), hint: `هامش ${netMargin.toFixed(1)}%` },
    { label: "إجمالي الأصول", value: formatMoney(balance.totalAssets, currency), hint: `كما في ${period.to}` },
    {
      label: "نسبة التداول",
      value: currentRatio === null ? "غير متاحة" : currentRatio.toFixed(2),
      hint: currentRatio === null ? "لا توجد التزامات متداولة" : "أصول متداولة ÷ التزامات متداولة",
    },
    {
      label: "ملاحظات الفحص",
      value: String(findings.length),
      hint: `${findings.filter((f) => f.severity === "critical" || f.severity === "high").length} عالية الخطورة`,
    },
    { label: "اشتباه تكرار", value: String(duplicates.length), hint: "مجموعات بحاجة لمراجعة" },
    { label: "عمليات غير معتادة", value: String(anomalies.length), hint: "مؤشرات إحصائية" },
  ];

  const topExpense = analysis.expenseBreakdown[0];
  const executiveSummary = [
    `بلغ صافي إيرادات ${company.name} عن الفترة من ${period.from} إلى ${period.to} مبلغ ${formatMoney(
      income.netRevenue,
      currency,
    )}، وبلغ صافي الربح ${formatMoney(income.netProfit, currency)} بهامش صافي ${netMargin.toFixed(1)}%.`,
    `مجمل الربح ${formatMoney(income.grossProfit, currency)} بهامش ${grossMargin.toFixed(
      1,
    )}%، والمصروفات التشغيلية ${formatMoney(income.operatingExpenses, currency)}.`,
    `إجمالي الأصول ${formatMoney(balance.totalAssets, currency)} مقابل إجمالي الالتزامات ${formatMoney(
      balance.totalLiabilities,
      currency,
    )} وحقوق ملكية ${formatMoney(balance.totalEquity, currency)}. ${
      balance.balanced
        ? "المعادلة المحاسبية متوازنة."
        : `يوجد فرق غير متوازن قدره ${formatMoney(balance.difference, currency)}.`
    }`,
    topExpense
      ? `أكبر بنود المصروفات هو «${topExpense.name}» بمبلغ ${formatMoney(
          topExpense.amount,
          currency,
        )} وبنسبة ${topExpense.share.toFixed(1)}% من إجمالي المصروفات.`
      : "لم تُسجل مصروفات في الفترة المحددة.",
    `أظهر الفحص ${findings.length} ملاحظة، منها ${
      findings.filter((f) => f.severity === "critical").length
    } حرجة، إضافة إلى ${duplicates.length} مجموعة اشتباه تكرار و${anomalies.length} مؤشر عملية غير معتادة.`,
  ];

  const recommendations: string[] = [];
  for (const finding of findings.filter((f) => f.severity === "critical" || f.severity === "high").slice(0, 4)) {
    recommendations.push(`${finding.title}: ${finding.recommendation}`);
  }
  for (const group of duplicates.filter((g) => g.strength === "strong").slice(0, 2)) {
    recommendations.push(group.recommendation);
  }
  for (const anomaly of anomalies.slice(0, 2)) {
    recommendations.push(`مراجعة ${anomaly.title}: ${anomaly.reasons[0] ?? anomaly.description}`);
  }
  if (!balance.balanced) {
    recommendations.push(
      "تصحيح فروقات المركز المالي قبل اعتماد القوائم، والتحقق من الأرصدة الافتتاحية والقيود غير المتوازنة.",
    );
  }
  if (cashFlow.available === false) {
    recommendations.push("رفع كشف بنك أو قيود نقدية تفصيلية لتمكين إعداد قائمة تدفقات نقدية موثوقة.");
  }
  if (!recommendations.length) {
    recommendations.push("استمرار المراجعة الدورية للملاحظات، وتوثيق مستندات القيود ذات المبالغ المرتفعة.");
  }

  const sources = [
    `عدد القيود المرحّلة في الفترة: ${trial.entryCount}`,
    `عدد الحسابات في الدليل: ${data.accounts.length}`,
    data.batches.length
      ? `عمليات الاستيراد: ${data.batches
          .slice(0, 5)
          .map((batch) => `${batch.fileName} (${batch.rowCount} صف)`)
          .join("، ")}`
      : "لم تُسجل عمليات استيراد؛ البيانات قد تكون تجريبية أو مدخلة مباشرة.",
    "مصدر الأرقام: محرك RAKAZ المحاسبي المحسوب من القيود المرحّلة فقط.",
  ];

  const limitations = [
    "التقرير تحليل مساعد أُعد آلياً، ولا يُعد رأياً قانونياً أو تقرير مراجعة معتمداً وفق المعايير المهنية.",
    "دقة النتائج تعتمد على اكتمال البيانات وتصنيف الحسابات وصحة القيود المستوردة.",
    "القيود المسودة والمستبعدة لا تدخل في الحسابات.",
    "مؤشرات التكرار والشذوذ إحصائية وقد تكون مبررة بطبيعة النشاط؛ يلزم مراجعة المستندات.",
    "قائمة التدفقات النقدية مبنية بالطريقة غير المباشرة من التغيرات في النقدية والبنك، ولا تُعرض إذا لم تكف البيانات.",
  ];

  return {
    company,
    period,
    generatedAt: new Date().toISOString(),
    trial,
    income,
    balance,
    cashFlow,
    equity,
    analysis,
    findings,
    duplicates,
    anomalies,
    kpis,
    executiveSummary,
    recommendations,
    sources,
    limitations,
  };
}
