import Decimal from "decimal.js";
import { dec, money, round2 } from "./money";
import { SUBTYPE_META } from "./accounts";
import {
  accountBalancesAt,
  addDays,
  buildTrialBalance,
  computeMovements,
  presentationAmount,
  startOfYear,
} from "./engine";
import type {
  Account,
  AccountSubtype,
  BalanceSheet,
  CashFlowStatement,
  DateRange,
  EquityStatement,
  IncomeStatement,
  Ledger,
  StatementLine,
} from "./types";

export interface PeriodOptions extends DateRange {
  /** بداية الفترة المالية، تُستخدم لتحديد ربح الفترة في المركز المالي. */
  periodStart?: string;
  includeCurrentPeriodProfit?: boolean;
}

interface BalanceContext {
  byCode: Map<string, Account>;
  balances: Map<string, { debit: Decimal; credit: Decimal; net: Decimal }>;
}

function contextAt(ledger: Pick<Ledger, "accounts" | "entries">, asOf: string): BalanceContext {
  const byCode = new Map<string, Account>();
  for (const account of ledger.accounts) byCode.set(account.code.trim(), account);
  return { byCode, balances: accountBalancesAt(ledger, asOf) };
}

function amountsBySubtype(
  ledger: Pick<Ledger, "accounts" | "entries">,
  range: DateRange,
): { bySubtype: Map<AccountSubtype, Decimal>; byAccount: Map<string, Decimal> } {
  const { movements } = computeMovements(ledger, range);
  const bySubtype = new Map<AccountSubtype, Decimal>();
  const byAccount = new Map<string, Decimal>();
  for (const m of movements.values()) {
    if (!m.account) continue;
    const net = m.debit.minus(m.credit);
    const amount = presentationAmount(m.account, net);
    byAccount.set(m.code, (byAccount.get(m.code) ?? new Decimal(0)).plus(amount));
    bySubtype.set(m.account.subtype, (bySubtype.get(m.account.subtype) ?? new Decimal(0)).plus(amount));
  }
  return { bySubtype, byAccount };
}

function get(map: Map<AccountSubtype, Decimal>, key: AccountSubtype): Decimal {
  return map.get(key) ?? new Decimal(0);
}

function n(value: Decimal): number {
  return money(value);
}

export function buildIncomeStatement(
  ledger: Pick<Ledger, "accounts" | "entries" | "currency">,
  options: PeriodOptions = {},
): IncomeStatement {
  const { bySubtype } = amountsBySubtype(ledger, { from: options.from, to: options.to });
  const warnings: string[] = [];
  const trial = buildTrialBalance(ledger, { from: options.from, to: options.to });
  if (!trial.balanced) {
    warnings.push(`ميزان المراجعة غير متوازن بفرق ${trial.difference.toFixed(2)}؛ قد تكون النتائج غير دقيقة.`);
  }
  if (trial.unknownAccounts?.length) {
    warnings.push(
      `توجد حسابات مستخدمة في القيود وغير موجودة في دليل الحسابات: ${trial.unknownAccounts.slice(0, 5).join("، ")}`,
    );
  }

  const revenue = get(bySubtype, "sales");
  const salesReturnsRaw = get(bySubtype, "sales_returns");
  const salesReturns = salesReturnsRaw.abs();
  const netRevenue = revenue.plus(salesReturnsRaw);
  const costOfSales = get(bySubtype, "cost_of_sales");
  const grossProfit = netRevenue.minus(costOfSales);
  const adminExpenses = get(bySubtype, "admin_expense");
  const marketingExpenses = get(bySubtype, "marketing_expense");
  const operatingExpensesRaw = get(bySubtype, "operating_expense");
  const depreciation = get(bySubtype, "depreciation");
  const operatingExpenses = operatingExpensesRaw.plus(adminExpenses).plus(marketingExpenses).plus(depreciation);
  const operatingProfit = grossProfit.minus(operatingExpenses);
  const financeExpenses = get(bySubtype, "finance_expense");
  const otherIncome = get(bySubtype, "other_income");
  const otherExpenses = get(bySubtype, "other_expense");
  const profitBeforeTax = operatingProfit.minus(financeExpenses).plus(otherIncome).minus(otherExpenses);
  const taxExpense = get(bySubtype, "tax_expense");
  const netProfit = profitBeforeTax.minus(taxExpense);

  if (costOfSales.isZero() && !revenue.isZero()) {
    warnings.push("لم تُسجّل تكلفة مبيعات. قد يكون مجمل الربح مبالغاً فيه إذا كانت هناك مشتريات أو مخزون غير مرحّل.");
  }
  if (depreciation.isZero()) {
    warnings.push("لا توجد مصروفات إهلاك مسجلة. تحقق من وجود أصول ثابتة تحتاج إلى إهلاك.");
  }
  if (taxExpense.isZero() && profitBeforeTax.gt(0)) {
    warnings.push("لا يوجد مصروف ضريبة مسجل رغم وجود ربح قبل الضريبة.");
  }

  const lines: StatementLine[] = [
    { key: "revenue", label: "الإيرادات", amount: n(revenue), level: 0 },
    { key: "sales_returns", label: "مردودات ومسموحات المبيعات", amount: n(salesReturnsRaw), level: 1 },
    { key: "net_revenue", label: "صافي الإيرادات", amount: n(netRevenue), level: 0, isTotal: true },
    { key: "cogs", label: "تكلفة المبيعات", amount: n(costOfSales.negated()), level: 1 },
    { key: "gross_profit", label: "مجمل الربح", amount: n(grossProfit), level: 0, isTotal: true },
    { key: "opex_header", label: "المصروفات التشغيلية", amount: 0, level: 0, isHeader: true },
    { key: "operating_expenses", label: "مصروفات تشغيلية", amount: n(operatingExpensesRaw.negated()), level: 1 },
    { key: "admin_expenses", label: "مصروفات إدارية وعمومية", amount: n(adminExpenses.negated()), level: 1 },
    { key: "marketing_expenses", label: "مصروفات تسويقية", amount: n(marketingExpenses.negated()), level: 1 },
    { key: "depreciation", label: "الإهلاك", amount: n(depreciation.negated()), level: 1 },
    {
      key: "total_opex",
      label: "إجمالي المصروفات التشغيلية",
      amount: n(operatingExpenses.negated()),
      level: 1,
      isTotal: true,
    },
    { key: "operating_profit", label: "الربح التشغيلي", amount: n(operatingProfit), level: 0, isTotal: true },
    { key: "finance_expenses", label: "المصروفات المالية", amount: n(financeExpenses.negated()), level: 1 },
    { key: "other_income", label: "إيرادات أخرى", amount: n(otherIncome), level: 1 },
    { key: "other_expenses", label: "مصروفات أخرى", amount: n(otherExpenses.negated()), level: 1 },
    { key: "profit_before_tax", label: "الربح قبل الضريبة", amount: n(profitBeforeTax), level: 0, isTotal: true },
    { key: "tax_expense", label: "مصروف الضريبة", amount: n(taxExpense.negated()), level: 1 },
    { key: "net_profit", label: "صافي الربح", amount: n(netProfit), level: 0, isTotal: true },
  ];

  return {
    lines,
    revenue: n(revenue),
    salesReturns: n(salesReturns),
    netRevenue: n(netRevenue),
    costOfSales: n(costOfSales),
    grossProfit: n(grossProfit),
    operatingExpenses: n(operatingExpenses),
    adminExpenses: n(adminExpenses),
    marketingExpenses: n(marketingExpenses),
    depreciation: n(depreciation),
    financeExpenses: n(financeExpenses),
    operatingProfit: n(operatingProfit),
    otherIncome: n(otherIncome),
    otherExpenses: n(otherExpenses),
    profitBeforeTax: n(profitBeforeTax),
    taxExpense: n(taxExpense),
    netProfit: n(netProfit),
    warnings,
    currency: ledger.currency,
    from: options.from,
    to: options.to,
  };
}

export function buildBalanceSheet(
  ledger: Pick<Ledger, "accounts" | "entries" | "currency">,
  options: PeriodOptions = {},
): BalanceSheet {
  const asOf = options.to ?? new Date().toISOString().slice(0, 10);
  const periodStart = options.periodStart ?? startOfYear(asOf);
  const includeProfit = options.includeCurrentPeriodProfit ?? true;
  const ctx = contextAt(ledger, asOf);
  const warnings: string[] = [];

  const bucket = new Map<AccountSubtype, Decimal>();
  for (const [code, balance] of ctx.balances) {
    const account = ctx.byCode.get(code);
    if (!account) continue;
    const amount = presentationAmount(account, balance.net);
    bucket.set(account.subtype, (bucket.get(account.subtype) ?? new Decimal(0)).plus(amount));
  }
  const b = (key: AccountSubtype) => bucket.get(key) ?? new Decimal(0);

  const cash = b("cash");
  const bank = b("bank");
  const receivables = b("receivable");
  const inventory = b("inventory");
  const otherCurrentAssets = b("other_current_asset");
  const totalCurrentAssets = cash.plus(bank).plus(receivables).plus(inventory).plus(otherCurrentAssets);
  const fixedAssets = b("fixed_asset");
  const accumulatedDepreciation = b("accumulated_depreciation");
  const netFixedAssets = fixedAssets.plus(accumulatedDepreciation);
  const otherAssets = b("other_asset");
  const totalAssets = totalCurrentAssets.plus(netFixedAssets).plus(otherAssets);

  const payables = b("payable");
  const taxPayable = b("tax_payable");
  const shortTermLoans = b("short_term_loan");
  const otherCurrentLiabilities = b("other_current_liability");
  const totalCurrentLiabilities = payables.plus(taxPayable).plus(shortTermLoans).plus(otherCurrentLiabilities);
  const longTermLiabilities = b("long_term_liability");
  const totalLiabilities = totalCurrentLiabilities.plus(longTermLiabilities);

  const capital = b("capital");
  const retainedEarnings = b("retained_earnings");
  const drawings = b("drawings").abs();

  const income = buildIncomeStatement(ledger, { from: periodStart, to: asOf });
  const currentPeriodProfit = includeProfit ? dec(income.netProfit) : new Decimal(0);
  const totalEquity = capital.plus(retainedEarnings).plus(currentPeriodProfit).minus(drawings);
  const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquity);
  const difference = round2(totalAssets.minus(totalLiabilitiesAndEquity));

  if (cash.lt(0)) warnings.push("رصيد النقدية سالب؛ قد يكون هناك خطأ في الترحيل أو سحب غير مسجل.");
  if (bank.lt(0)) warnings.push("رصيد البنك سالب؛ تحقق من مطابقة كشف البنك.");
  if (!includeProfit) warnings.push("لم يتم تضمين ربح الفترة الحالية في حقوق الملكية حسب الإعداد المختار.");
  if (currentPeriodProfit.abs().gt(0) && !retainedEarnings.isZero()) {
    warnings.push("يوجد رصيد أرباح محتجزة مع ربح فترة حالية. تحقق من عدم ازدواج الأرباح إذا كانت هناك قيود إقفال جزئية.");
  }
  if (!difference.isZero()) {
    warnings.push(
      `قائمة المركز المالي غير متوازنة بفرق ${difference.toFixed(2)}. الأصول لا تساوي الالتزامات وحقوق الملكية.`,
    );
  }

  const lines: StatementLine[] = [
    { key: "assets_header", label: "الأصول", amount: 0, level: 0, isHeader: true },
    { key: "current_assets_header", label: "الأصول المتداولة", amount: 0, level: 1, isHeader: true },
    { key: "cash", label: "النقدية", amount: n(cash), level: 2 },
    { key: "bank", label: "البنك", amount: n(bank), level: 2 },
    { key: "receivables", label: "العملاء (المدينون)", amount: n(receivables), level: 2 },
    { key: "inventory", label: "المخزون", amount: n(inventory), level: 2 },
    { key: "other_current_assets", label: "أصول متداولة أخرى", amount: n(otherCurrentAssets), level: 2 },
    {
      key: "total_current_assets",
      label: "إجمالي الأصول المتداولة",
      amount: n(totalCurrentAssets),
      level: 1,
      isTotal: true,
    },
    { key: "fixed_assets", label: "الأصول الثابتة", amount: n(fixedAssets), level: 1 },
    { key: "accumulated_depreciation", label: "مجمع الإهلاك", amount: n(accumulatedDepreciation), level: 2 },
    { key: "net_fixed_assets", label: "صافي الأصول الثابتة", amount: n(netFixedAssets), level: 1, isTotal: true },
    { key: "other_assets", label: "أصول أخرى", amount: n(otherAssets), level: 1 },
    { key: "total_assets", label: "إجمالي الأصول", amount: n(totalAssets), level: 0, isTotal: true },
    { key: "liabilities_header", label: "الالتزامات وحقوق الملكية", amount: 0, level: 0, isHeader: true },
    { key: "current_liabilities_header", label: "الالتزامات المتداولة", amount: 0, level: 1, isHeader: true },
    { key: "payables", label: "الموردون (الدائنون)", amount: n(payables), level: 2 },
    { key: "tax_payable", label: "ضرائب مستحقة", amount: n(taxPayable), level: 2 },
    { key: "short_term_loans", label: "قروض قصيرة الأجل", amount: n(shortTermLoans), level: 2 },
    {
      key: "other_current_liabilities",
      label: "التزامات متداولة أخرى",
      amount: n(otherCurrentLiabilities),
      level: 2,
    },
    {
      key: "total_current_liabilities",
      label: "إجمالي الالتزامات المتداولة",
      amount: n(totalCurrentLiabilities),
      level: 1,
      isTotal: true,
    },
    { key: "long_term_liabilities", label: "التزامات طويلة الأجل", amount: n(longTermLiabilities), level: 1 },
    { key: "total_liabilities", label: "إجمالي الالتزامات", amount: n(totalLiabilities), level: 1, isTotal: true },
    { key: "equity_header", label: "حقوق الملكية", amount: 0, level: 1, isHeader: true },
    { key: "capital", label: "رأس المال", amount: n(capital), level: 2 },
    { key: "retained_earnings", label: "الأرباح المحتجزة", amount: n(retainedEarnings), level: 2 },
    { key: "current_profit", label: "ربح الفترة الحالية", amount: n(currentPeriodProfit), level: 2 },
    { key: "drawings", label: "المسحوبات والتوزيعات", amount: n(drawings.negated()), level: 2 },
    { key: "total_equity", label: "إجمالي حقوق الملكية", amount: n(totalEquity), level: 1, isTotal: true },
    {
      key: "total_liabilities_equity",
      label: "إجمالي الالتزامات وحقوق الملكية",
      amount: n(totalLiabilitiesAndEquity),
      level: 0,
      isTotal: true,
    },
  ];

  return {
    lines,
    currentAssets: n(totalCurrentAssets),
    cash: n(cash),
    bank: n(bank),
    receivables: n(receivables),
    inventory: n(inventory),
    otherCurrentAssets: n(otherCurrentAssets),
    totalCurrentAssets: n(totalCurrentAssets),
    fixedAssets: n(fixedAssets),
    accumulatedDepreciation: n(accumulatedDepreciation),
    netFixedAssets: n(netFixedAssets),
    otherAssets: n(otherAssets),
    totalAssets: n(totalAssets),
    currentLiabilities: n(totalCurrentLiabilities),
    payables: n(payables),
    taxPayable: n(taxPayable),
    shortTermLoans: n(shortTermLoans),
    otherCurrentLiabilities: n(otherCurrentLiabilities),
    totalCurrentLiabilities: n(totalCurrentLiabilities),
    longTermLiabilities: n(longTermLiabilities),
    totalLiabilities: n(totalLiabilities),
    capital: n(capital),
    retainedEarnings: n(retainedEarnings),
    currentPeriodProfit: n(currentPeriodProfit),
    drawings: n(drawings),
    totalEquity: n(totalEquity),
    totalLiabilitiesAndEquity: n(totalLiabilitiesAndEquity),
    balanced: difference.abs().lte(new Decimal("0.01")),
    difference: n(difference),
    warnings,
    currency: ledger.currency,
    asOf,
  };
}

function subtypeBalance(ctx: BalanceContext, subtype: AccountSubtype): Decimal {
  let total = new Decimal(0);
  for (const [code, balance] of ctx.balances) {
    const account = ctx.byCode.get(code);
    if (!account || account.subtype !== subtype) continue;
    total = total.plus(presentationAmount(account, balance.net));
  }
  return total;
}

export function buildCashFlowStatement(
  ledger: Pick<Ledger, "accounts" | "entries" | "currency">,
  options: PeriodOptions = {},
): CashFlowStatement {
  const warnings: string[] = [];
  const to = options.to;
  const from = options.from;
  if (!from || !to) {
    return {
      lines: [],
      operating: 0,
      investing: 0,
      financing: 0,
      netChange: 0,
      openingCash: 0,
      closingCash: 0,
      method: "indirect",
      warnings: ["يلزم تحديد فترة (من/إلى) لإعداد قائمة التدفقات النقدية."],
      currency: ledger.currency,
      from,
      to,
      available: false,
    };
  }

  const opening = contextAt(ledger, addDays(from, -1));
  const closing = contextAt(ledger, to);
  const income = buildIncomeStatement(ledger, { from, to });
  const depreciation = dec(income.depreciation);

  const openingCash = subtypeBalance(opening, "cash").plus(subtypeBalance(opening, "bank"));
  const closingCash = subtypeBalance(closing, "cash").plus(subtypeBalance(closing, "bank"));
  const actualChange = closingCash.minus(openingCash);

  const delta = (subtype: AccountSubtype) => subtypeBalance(closing, subtype).minus(subtypeBalance(opening, subtype));

  const dReceivables = delta("receivable");
  const dInventory = delta("inventory");
  const dOtherCurrentAssets = delta("other_current_asset");
  const dOtherAssets = delta("other_asset");
  const dPayables = delta("payable");
  const dTaxPayable = delta("tax_payable");
  const dOtherCurrentLiabilities = delta("other_current_liability");
  const dFixedAssets = delta("fixed_asset");
  const dCapital = delta("capital");
  const dDrawings = delta("drawings");
  const dShortLoans = delta("short_term_loan");
  const dLongLoans = delta("long_term_liability");

  const netProfit = dec(income.netProfit);
  const workingCapitalChange = dReceivables
    .negated()
    .plus(dInventory.negated())
    .plus(dOtherCurrentAssets.negated())
    .plus(dPayables)
    .plus(dTaxPayable)
    .plus(dOtherCurrentLiabilities);
  const operating = netProfit.plus(depreciation).plus(workingCapitalChange);
  const investing = dFixedAssets.negated().plus(dOtherAssets.negated());
  const financing = dCapital.plus(dShortLoans).plus(dLongLoans).minus(dDrawings.abs());
  const netChange = operating.plus(investing).plus(financing);
  const reconciliation = actualChange.minus(netChange);

  if (reconciliation.abs().gt(new Decimal("1"))) {
    warnings.push(
      `فرق تسوية بين صافي التغير المحسوب (${netChange.toFixed(2)}) والتغير الفعلي في النقدية (${actualChange.toFixed(2)}). قد تكون هناك حركات نقدية غير مصنفة أو بيانات ناقصة.`,
    );
  }
  if (dFixedAssets.gt(0)) {
    warnings.push(
      "تم اعتبار الزيادة في الأصول الثابتة مشتريات نقدية. لا تتوفر بيانات كافية لفصل عمليات الاستحواذ غير النقدية أو التخلصات.",
    );
  }
  warnings.push("أُعدت القائمة بالطريقة غير المباشرة من حركات الأرصدة الفعلية. لا تُغني عن مراجعة المستندات والتسويات.");

  const lines: StatementLine[] = [
    {
      key: "operating_header",
      label: "التدفقات النقدية من الأنشطة التشغيلية",
      amount: 0,
      level: 0,
      isHeader: true,
    },
    { key: "net_profit", label: "صافي الربح", amount: n(netProfit), level: 1 },
    { key: "depreciation", label: "إضافة: الإهلاك", amount: n(depreciation), level: 1 },
    { key: "d_receivables", label: "التغير في العملاء", amount: n(dReceivables.negated()), level: 1 },
    { key: "d_inventory", label: "التغير في المخزون", amount: n(dInventory.negated()), level: 1 },
    { key: "d_other_ca", label: "التغير في أصول متداولة أخرى", amount: n(dOtherCurrentAssets.negated()), level: 1 },
    { key: "d_payables", label: "التغير في الموردين", amount: n(dPayables), level: 1 },
    { key: "d_tax", label: "التغير في الضرائب المستحقة", amount: n(dTaxPayable), level: 1 },
    {
      key: "d_other_cl",
      label: "التغير في التزامات متداولة أخرى",
      amount: n(dOtherCurrentLiabilities),
      level: 1,
    },
    { key: "operating_total", label: "صافي التدفقات التشغيلية", amount: n(operating), level: 0, isTotal: true },
    {
      key: "investing_header",
      label: "التدفقات النقدية من الأنشطة الاستثمارية",
      amount: 0,
      level: 0,
      isHeader: true,
    },
    { key: "fixed_assets_change", label: "التغير في الأصول الثابتة", amount: n(dFixedAssets.negated()), level: 1 },
    { key: "other_assets_change", label: "التغير في أصول أخرى", amount: n(dOtherAssets.negated()), level: 1 },
    { key: "investing_total", label: "صافي التدفقات الاستثمارية", amount: n(investing), level: 0, isTotal: true },
    {
      key: "financing_header",
      label: "التدفقات النقدية من الأنشطة التمويلية",
      amount: 0,
      level: 0,
      isHeader: true,
    },
    { key: "capital_change", label: "التغير في رأس المال", amount: n(dCapital), level: 1 },
    { key: "loans_change", label: "التغير في القروض", amount: n(dShortLoans.plus(dLongLoans)), level: 1 },
    { key: "drawings_change", label: "المسحوبات والتوزيعات", amount: n(dDrawings.abs().negated()), level: 1 },
    { key: "financing_total", label: "صافي التدفقات التمويلية", amount: n(financing), level: 0, isTotal: true },
    { key: "net_change", label: "صافي التغير في النقدية", amount: n(netChange), level: 0, isTotal: true },
    { key: "opening_cash", label: "النقدية أول الفترة", amount: n(openingCash), level: 1 },
    { key: "closing_cash", label: "النقدية آخر الفترة", amount: n(closingCash), level: 1, isTotal: true },
    {
      key: "reconciliation",
      label: "فرق التسوية (للمراجعة)",
      amount: n(reconciliation),
      level: 2,
      note: "يجب أن يكون صفراً في البيانات المكتملة",
    },
  ];

  return {
    lines,
    operating: n(operating),
    investing: n(investing),
    financing: n(financing),
    netChange: n(netChange),
    openingCash: n(openingCash),
    closingCash: n(closingCash),
    method: "indirect",
    warnings,
    currency: ledger.currency,
    from,
    to,
    available: true,
  };
}

export function buildEquityStatement(
  ledger: Pick<Ledger, "accounts" | "entries" | "currency">,
  options: PeriodOptions = {},
): EquityStatement {
  const warnings: string[] = [];
  const to = options.to;
  const from = options.from;
  if (!from || !to) {
    return {
      lines: [],
      openingCapital: 0,
      capitalAdditions: 0,
      openingRetained: 0,
      netProfit: 0,
      drawings: 0,
      distributions: 0,
      closingCapital: 0,
      closingRetained: 0,
      totalEquity: 0,
      warnings: ["يلزم تحديد فترة (من/إلى) لإعداد قائمة التغيرات في حقوق الملكية."],
      currency: ledger.currency,
      from,
      to,
    };
  }
  const opening = contextAt(ledger, addDays(from, -1));
  const closing = contextAt(ledger, to);
  const income = buildIncomeStatement(ledger, { from, to });

  const openingCapital = subtypeBalance(opening, "capital");
  const closingCapital = subtypeBalance(closing, "capital");
  const openingRetained = subtypeBalance(opening, "retained_earnings");
  const closingRetained = subtypeBalance(closing, "retained_earnings");
  const drawings = subtypeBalance(closing, "drawings")
    .abs()
    .minus(subtypeBalance(opening, "drawings").abs());
  const netProfit = dec(income.netProfit);
  const capitalAdditions = closingCapital.minus(openingCapital);
  const distributions = drawings.gt(0) ? drawings : new Decimal(0);
  const totalEquity = closingCapital.plus(closingRetained).plus(netProfit).minus(distributions);

  if (!netProfit.isZero() && !closingRetained.minus(openingRetained).isZero()) {
    warnings.push("تغيرت الأرباح المحتجزة خلال الفترة مع وجود ربح جارٍ. تحقق من قيود الإقفال لتجنب ازدواج الأرباح.");
  }

  const lines: StatementLine[] = [
    { key: "opening_capital", label: "رأس المال أول الفترة", amount: n(openingCapital), level: 0 },
    { key: "capital_additions", label: "إضافات رأس المال", amount: n(capitalAdditions), level: 1 },
    { key: "closing_capital", label: "رأس المال آخر الفترة", amount: n(closingCapital), level: 1, isTotal: true },
    { key: "opening_retained", label: "الأرباح المحتجزة أول الفترة", amount: n(openingRetained), level: 0 },
    { key: "net_profit", label: "صافي ربح الفترة", amount: n(netProfit), level: 1 },
    { key: "distributions", label: "المسحوبات والتوزيعات", amount: n(distributions.negated()), level: 1 },
    {
      key: "closing_retained",
      label: "الأرباح المحتجزة آخر الفترة",
      amount: n(closingRetained),
      level: 1,
      isTotal: true,
    },
    { key: "total_equity", label: "إجمالي حقوق الملكية آخر الفترة", amount: n(totalEquity), level: 0, isTotal: true },
  ];

  return {
    lines,
    openingCapital: n(openingCapital),
    capitalAdditions: n(capitalAdditions),
    openingRetained: n(openingRetained),
    netProfit: n(netProfit),
    drawings: n(drawings),
    distributions: n(distributions),
    closingCapital: n(closingCapital),
    closingRetained: n(closingRetained),
    totalEquity: n(totalEquity),
    warnings,
    currency: ledger.currency,
    from,
    to,
  };
}

export function isKnownSubtype(subtype: string): subtype is AccountSubtype {
  return Object.prototype.hasOwnProperty.call(SUBTYPE_META, subtype);
}
