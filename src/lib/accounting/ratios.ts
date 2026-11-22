import Decimal from "decimal.js";
import { dec, money, round2 } from "./money";
import { accountBalancesAt, addDays, listMonths, previousPeriod, presentationAmount } from "./engine";
import { buildBalanceSheet, buildIncomeStatement } from "./statements";
import type {
  Account,
  AccountSubtype,
  DateRange,
  FinancialAnalysis,
  IncomeStatement,
  Ledger,
  RatioResult,
} from "./types";

function ratio(
  key: string,
  label: string,
  value: Decimal | null,
  unit: RatioResult["unit"],
  formula: string,
  interpretation: string,
  benchmark?: string,
): RatioResult {
  if (value === null || !value.isFinite()) {
    return {
      key,
      label,
      value: null,
      unit,
      formula,
      interpretation,
      available: false,
      unavailableReason: "البيانات المتاحة لا تكفي لحساب النسبة بدقة.",
      benchmark,
    };
  }
  return {
    key,
    label,
    value: round2(value).toNumber(),
    unit,
    formula,
    interpretation,
    available: true,
    benchmark,
  };
}

function subtypeBalanceAt(
  ledger: Pick<Ledger, "accounts" | "entries">,
  asOf: string,
  subtype: AccountSubtype,
): Decimal {
  const byCode = new Map<string, Account>();
  for (const a of ledger.accounts) byCode.set(a.code.trim(), a);
  const balances = accountBalancesAt(ledger, asOf);
  let total = new Decimal(0);
  for (const [code, bal] of balances) {
    const account = byCode.get(code);
    if (account?.subtype === subtype) total = total.plus(presentationAmount(account, bal.net));
  }
  return total;
}

function changePercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return money(dec(current).minus(previous).div(Math.abs(previous)).times(100));
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function buildFinancialAnalysis(
  ledger: Pick<Ledger, "accounts" | "entries" | "currency">,
  options: DateRange = {},
): FinancialAnalysis {
  const to = options.to ?? new Date().toISOString().slice(0, 10);
  const from = options.from ?? `${to.slice(0, 4)}-01-01`;
  const warnings: string[] = [];

  const income = buildIncomeStatement(ledger, { from, to });
  const balance = buildBalanceSheet(ledger, { from, to, periodStart: from });
  const openingDate = addDays(from, -1);
  const previous = previousPeriod({ from, to });
  const previousIncome = buildIncomeStatement(ledger, previous);

  const openingInventory = subtypeBalanceAt(ledger, openingDate, "inventory");
  const closingInventory = dec(balance.inventory);
  const openingReceivables = subtypeBalanceAt(ledger, openingDate, "receivable");
  const closingReceivables = dec(balance.receivables);
  const openingPayables = subtypeBalanceAt(ledger, openingDate, "payable");
  const closingPayables = dec(balance.payables);

  const avg = (a: Decimal, b: Decimal) => a.plus(b).div(2);
  const currentAssets = dec(balance.totalCurrentAssets);
  const currentLiabilities = dec(balance.totalCurrentLiabilities);
  const totalAssets = dec(balance.totalAssets);
  const totalLiabilities = dec(balance.totalLiabilities);
  const totalEquity = dec(balance.totalEquity);
  const netRevenue = dec(income.netRevenue);
  const cogs = dec(income.costOfSales);

  const canAverage = (opening: Decimal, closing: Decimal) =>
    !opening.isZero() && !closing.isZero() ? avg(opening, closing) : null;

  const inventoryBase = canAverage(openingInventory, closingInventory);
  const receivableBase = canAverage(openingReceivables, closingReceivables);
  const payableBase = canAverage(openingPayables, closingPayables);

  const inventoryTurnover =
    inventoryBase && !cogs.isZero() && inventoryBase.gt(0) ? cogs.div(inventoryBase) : null;
  const receivableTurnover =
    receivableBase && !netRevenue.isZero() && receivableBase.gt(0) ? netRevenue.div(receivableBase) : null;
  const payableTurnover =
    payableBase && !cogs.isZero() && payableBase.gt(0) ? cogs.div(payableBase) : null;

  const ratios: RatioResult[] = [
    ratio(
      "current_ratio",
      "نسبة التداول",
      currentLiabilities.gt(0) ? currentAssets.div(currentLiabilities) : null,
      "ratio",
      "الأصول المتداولة ÷ الالتزامات المتداولة",
      "تقيس قدرة الشركة على سداد التزاماتها قصيرة الأجل. القيمة الأعلى من 1 تعني سيولة موجبة.",
      "المعيار الشائع: 1.5 – 2.0",
    ),
    ratio(
      "quick_ratio",
      "نسبة السيولة السريعة",
      currentLiabilities.gt(0) ? currentAssets.minus(closingInventory).div(currentLiabilities) : null,
      "ratio",
      "(الأصول المتداولة − المخزون) ÷ الالتزامات المتداولة",
      "تقيس السيولة دون الاعتماد على بيع المخزون.",
      "المعيار الشائع: 1.0 أو أعلى",
    ),
    ratio(
      "gross_margin",
      "هامش الربح الإجمالي",
      netRevenue.gt(0) ? dec(income.grossProfit).div(netRevenue).times(100) : null,
      "percent",
      "مجمل الربح ÷ صافي الإيرادات × 100",
      "يعكس كفاءة التسعير وإدارة تكلفة المبيعات.",
    ),
    ratio(
      "operating_margin",
      "هامش الربح التشغيلي",
      netRevenue.gt(0) ? dec(income.operatingProfit).div(netRevenue).times(100) : null,
      "percent",
      "الربح التشغيلي ÷ صافي الإيرادات × 100",
      "يقيس ربحية النشاط التشغيلي قبل البنود غير التشغيلية والضريبة.",
    ),
    ratio(
      "net_margin",
      "هامش صافي الربح",
      netRevenue.gt(0) ? dec(income.netProfit).div(netRevenue).times(100) : null,
      "percent",
      "صافي الربح ÷ صافي الإيرادات × 100",
      "يعكس الربحية النهائية بعد جميع المصروفات والضرائب.",
    ),
    ratio(
      "debt_ratio",
      "نسبة المديونية",
      totalAssets.gt(0) ? totalLiabilities.div(totalAssets).times(100) : null,
      "percent",
      "إجمالي الالتزامات ÷ إجمالي الأصول × 100",
      "نسبة أعلى تعني اعتماداً أكبر على التمويل بالدين ومخاطر مالية أعلى.",
      "المعيار الشائع: أقل من 60%",
    ),
    ratio(
      "equity_ratio",
      "نسبة حقوق الملكية",
      totalAssets.gt(0) ? totalEquity.div(totalAssets).times(100) : null,
      "percent",
      "حقوق الملكية ÷ إجمالي الأصول × 100",
      "تعكس متانة المركز المالي وقدرة الشركة على تحمل الخسائر.",
    ),
    ratio(
      "inventory_turnover",
      "معدل دوران المخزون",
      inventoryTurnover,
      "times",
      "تكلفة المبيعات ÷ متوسط المخزون (افتتاحي + ختامي ÷ 2)",
      "عدد مرات تصريف المخزون خلال الفترة. يحتاج رصيداً افتتاحياً وختامياً.",
    ),
    ratio(
      "inventory_days",
      "متوسط أيام المخزون",
      inventoryTurnover && inventoryTurnover.gt(0) ? new Decimal(365).div(inventoryTurnover) : null,
      "days",
      "365 ÷ معدل دوران المخزون",
      "متوسط المدة التي يبقى فيها المخزون قبل بيعه.",
    ),
    ratio(
      "receivable_turnover",
      "معدل دوران العملاء",
      receivableTurnover,
      "times",
      "صافي الإيرادات ÷ متوسط العملاء",
      "عدد مرات تحصيل أرصدة العملاء خلال الفترة.",
    ),
    ratio(
      "receivable_days",
      "متوسط فترة التحصيل",
      receivableTurnover && receivableTurnover.gt(0) ? new Decimal(365).div(receivableTurnover) : null,
      "days",
      "365 ÷ معدل دوران العملاء",
      "متوسط الأيام اللازمة لتحصيل المبيعات الآجلة.",
    ),
    ratio(
      "payable_turnover",
      "معدل دوران الموردين",
      payableTurnover,
      "times",
      "تكلفة المبيعات ÷ متوسط الموردين",
      "عدد مرات سداد أرصدة الموردين خلال الفترة.",
    ),
    ratio(
      "payable_days",
      "متوسط فترة السداد",
      payableTurnover && payableTurnover.gt(0) ? new Decimal(365).div(payableTurnover) : null,
      "days",
      "365 ÷ معدل دوران الموردين",
      "متوسط الأيام التي تستغرقها الشركة لسداد الموردين.",
    ),
    ratio(
      "roa",
      "العائد على الأصول",
      totalAssets.gt(0) ? dec(income.netProfit).div(totalAssets).times(100) : null,
      "percent",
      "صافي الربح ÷ إجمالي الأصول × 100",
      "كفاءة استخدام الأصول في توليد الأرباح.",
    ),
    ratio(
      "roe",
      "العائد على حقوق الملكية",
      totalEquity.gt(0) ? dec(income.netProfit).div(totalEquity).times(100) : null,
      "percent",
      "صافي الربح ÷ حقوق الملكية × 100",
      "العائد المتحقق لأصحاب رأس المال.",
    ),
    ratio(
      "expense_ratio",
      "نسبة المصروفات إلى الإيرادات",
      netRevenue.gt(0)
        ? dec(income.operatingExpenses).plus(income.financeExpenses).div(netRevenue).times(100)
        : null,
      "percent",
      "(المصروفات التشغيلية + المالية) ÷ صافي الإيرادات × 100",
      "كلما انخفضت دلّ ذلك على كفاءة أعلى في إدارة المصروفات.",
    ),
  ];

  const months = listMonths(from, to);
  const monthly = months.map((month) => {
    const r = monthRange(month);
    const is = buildIncomeStatement(ledger, r);
    return {
      period: month,
      revenue: is.netRevenue,
      expenses: round2(dec(is.operatingExpenses).plus(is.financeExpenses).plus(is.taxExpense)).toNumber(),
      profit: is.netProfit,
    };
  });

  const expenseAccounts: Array<{ code: string; name: string; amount: number; share: number }> = [];
  const byCode = new Map<string, Account>();
  for (const a of ledger.accounts) byCode.set(a.code.trim(), a);
  const totals = new Map<string, Decimal>();
  for (const entry of ledger.entries) {
    if (entry.status !== "posted") continue;
    if (entry.date < from || entry.date > to) continue;
    for (const line of entry.lines) {
      const account = byCode.get(line.accountCode?.trim());
      if (!account || account.type !== "expense") continue;
      const amount = dec(line.debit).minus(dec(line.credit));
      totals.set(account.code, (totals.get(account.code) ?? new Decimal(0)).plus(amount));
    }
  }
  const totalExpenses = [...totals.values()].reduce((s, v) => s.plus(v), new Decimal(0));
  for (const [code, amount] of totals) {
    if (amount.isZero()) continue;
    expenseAccounts.push({
      code,
      name: byCode.get(code)?.name ?? code,
      amount: money(amount),
      share: totalExpenses.gt(0) ? money(amount.div(totalExpenses).times(100)) : 0,
    });
  }
  expenseAccounts.sort((a, b) => b.amount - a.amount);

  if (!income.warnings.length) {
    // لا تحذيرات إضافية عند اكتمال البيانات الأساسية.
  } else {
    warnings.push(...income.warnings);
  }
  if (balance.warnings.length) warnings.push(...balance.warnings);
  if (!receivableBase) warnings.push("لا يمكن حساب معدل دوران العملاء بدقة لعدم توفر أرصدة افتتاحية وختامية.");
  if (!inventoryBase) warnings.push("لا يمكن حساب معدل دوران المخزون بدقة لعدم توفر أرصدة مخزون افتتاحية وختامية.");

  return {
    ratios,
    revenueChange: changePercent(income.netRevenue, previousIncome.netRevenue),
    expenseChange: changePercent(income.operatingExpenses, previousIncome.operatingExpenses),
    profitChange: changePercent(income.netProfit, previousIncome.netProfit),
    monthly,
    expenseBreakdown: expenseAccounts,
    warnings: [...new Set(warnings)],
    from,
    to,
    currency: ledger.currency,
  };
}

export interface TrendPoint {
  period: string;
  revenue: number;
  expenses: number;
  profit: number;
  revenueGrowth: number | null;
}

export function buildTrends(analysis: FinancialAnalysis): TrendPoint[] {
  return analysis.monthly.map((point, index) => {
    const prev = analysis.monthly[index - 1];
    return {
      ...point,
      revenueGrowth: prev ? changePercent(point.revenue, prev.revenue) : null,
    };
  });
}

export function buildMonthlyIncomeStatements(
  ledger: Pick<Ledger, "accounts" | "entries" | "currency">,
  range: DateRange,
): Array<{ period: string; statement: IncomeStatement }> {
  const to = range.to ?? new Date().toISOString().slice(0, 10);
  const from = range.from ?? `${to.slice(0, 4)}-01-01`;
  return listMonths(from, to).map((month) => ({
    period: month,
    statement: buildIncomeStatement(ledger, monthRange(month)),
  }));
}
