import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { dec, money, round2, sum, toMoney } from "@/lib/accounting/money";
import {
  accountBalancesAt,
  buildTrialBalance,
  entryTotals,
  validateEntry,
} from "@/lib/accounting/engine";
import {
  buildBalanceSheet,
  buildCashFlowStatement,
  buildEquityStatement,
  buildIncomeStatement,
} from "@/lib/accounting/statements";
import { buildFinancialAnalysis } from "@/lib/accounting/ratios";
import { detectAuditFindings } from "@/lib/accounting/findings";
import { detectDuplicates } from "@/lib/accounting/duplicates";
import type { Account, AccountSubtype, AccountType, JournalEntry, Ledger } from "@/lib/accounting/types";

function account(
  code: string,
  name: string,
  type: AccountType,
  subtype: AccountSubtype,
  openingBalance?: string,
  openingBalanceType?: "debit" | "credit",
): Account {
  return {
    id: `a-${code}`,
    code,
    name,
    type,
    subtype,
    isActive: true,
    openingBalance,
    openingBalanceType,
  };
}

/** دليل حسابات مبسط بأرصدة افتتاحية متوازنة (150,000 مدين = 150,000 دائن). */
const accounts: Account[] = [
  account("1010", "النقدية", "asset", "cash", "50000", "debit"),
  account("1020", "البنك", "asset", "bank", "70000", "debit"),
  account("1100", "العملاء", "asset", "receivable"),
  account("1200", "المخزون", "asset", "inventory"),
  account("1500", "الأصول الثابتة", "asset", "fixed_asset", "30000", "debit"),
  account("1590", "مجمع الإهلاك", "asset", "accumulated_depreciation"),
  account("2010", "الموردون", "liability", "payable"),
  account("2020", "ضرائب مستحقة", "liability", "tax_payable"),
  account("3010", "رأس المال", "equity", "capital", "130000", "credit"),
  account("3020", "الأرباح المحتجزة", "equity", "retained_earnings", "20000", "credit"),
  account("3030", "المسحوبات", "equity", "drawings"),
  account("4010", "المبيعات", "revenue", "sales"),
  account("4020", "مردودات المبيعات", "revenue", "sales_returns"),
  account("5010", "تكلفة المبيعات", "expense", "cost_of_sales"),
  account("6010", "مصروفات إدارية", "expense", "admin_expense"),
  account("6020", "مصروفات تسويقية", "expense", "marketing_expense"),
  account("6030", "الإهلاك", "expense", "depreciation"),
  account("7010", "مصروفات مالية", "expense", "finance_expense"),
  account("8010", "مصروف الضريبة", "expense", "tax_expense"),
];

function entry(
  id: string,
  date: string,
  description: string,
  lines: Array<[code: string, debit: number | string, credit: number | string]>,
  extra: Partial<JournalEntry> = {},
): JournalEntry {
  return {
    id,
    entryNumber: extra.entryNumber ?? id.toUpperCase(),
    date,
    description,
    source: "manual",
    status: "posted",
    currency: "SAR",
    ...extra,
    lines: lines.map(([code, debit, credit], index) => ({
      id: `${id}-l${index}`,
      entryId: id,
      accountCode: code,
      debit,
      credit,
    })),
  };
}

/**
 * سيناريو محسوب يدوياً:
 * مبيعات 60,000 آجلة، تحصيل 45,000، مردودات 5,000، تكلفة مبيعات 35,000،
 * شراء مخزون 40,000 على الحساب، سداد مورد 25,000، مصروفات إدارية 8,000،
 * تسويق 3,000، إهلاك 2,500، فوائد 1,200، ضريبة 1,500، مسحوبات 4,000.
 */
const entries: JournalEntry[] = [
  entry("e1", "2025-03-05", "مبيعات آجلة", [["1100", 60000, 0], ["4010", 0, 60000]], { entryNumber: "S-001", source: "sales" }),
  entry("e2", "2025-04-10", "تحصيل من عميل", [["1020", 45000, 0], ["1100", 0, 45000]], { entryNumber: "R-001" }),
  entry("e3", "2025-04-20", "مردودات مبيعات", [["4020", 5000, 0], ["1100", 0, 5000]], { entryNumber: "SR-001" }),
  entry("e4", "2025-03-05", "تكلفة المبيعات", [["5010", 35000, 0], ["1200", 0, 35000]], { entryNumber: "C-001" }),
  entry("e5", "2025-05-01", "شراء مخزون على الحساب", [["1200", 40000, 0], ["2010", 0, 40000]], { entryNumber: "P-001" }),
  entry("e6", "2025-06-01", "سداد مورد", [["2010", 25000, 0], ["1020", 0, 25000]], { entryNumber: "PY-001" }),
  entry("e7", "2025-06-15", "مصروفات إدارية", [["6010", 8000, 0], ["1020", 0, 8000]], { entryNumber: "AD-001" }),
  entry("e8", "2025-07-01", "مصروفات تسويق", [["6020", 3000, 0], ["2010", 0, 3000]], { entryNumber: "MK-001" }),
  entry("e9", "2025-12-31", "إهلاك الأصول", [["6030", 2500, 0], ["1590", 0, 2500]], { entryNumber: "DP-001" }),
  entry("e10", "2025-08-01", "فوائد بنكية", [["7010", 1200, 0], ["1020", 0, 1200]], { entryNumber: "FN-001" }),
  entry("e11", "2025-12-31", "مصروف ضريبة مستحق", [["8010", 1500, 0], ["2020", 0, 1500]], { entryNumber: "TX-001" }),
  entry("e12", "2025-09-01", "مسحوبات المالك", [["3030", 4000, 0], ["1020", 0, 4000]], { entryNumber: "DR-001" }),
];

const ledger: Ledger = { accounts, entries, currency: "SAR" };
const year = { from: "2025-01-01", to: "2025-12-31" };

describe("دقة الأرقام المالية", () => {
  it("يجمع الكسور العشرية بدقة تامة دون أخطاء floating point", () => {
    expect(sum(["0.1", "0.2"]).toString()).toBe("0.3");
    expect(dec(sum([0.1, 0.2, 0.3, 0.4])).toString()).toBe("1");
    expect(new Decimal(0.1).plus(0.2).equals(new Decimal("0.3"))).toBe(true);
  });

  it("يقرّب بنصف لأعلى كما في القوائم المالية", () => {
    expect(round2("2.345").toString()).toBe("2.35");
    expect(round2("-2.345").toString()).toBe("-2.35");
    expect(round2("1.004").toString()).toBe("1");
    expect(money(0.005)).toBe(0.01);
  });

  it("يتعامل مع المبالغ الكبيرة دون فقدان cents", () => {
    expect(sum(["9999999999999.99", "0.01"]).toString()).toBe("10000000000000");
    expect(money("1234567890123.455")).toBe(1234567890123.46);
  });

  it("يقرأ الصيغ المحاسبية الشائعة", () => {
    expect(toMoney("1,234.567").toString()).toBe("1234.567");
    expect(toMoney("(1,500.50)").toString()).toBe("-1500.5");
    expect(toMoney("٤٥٬٥٤٢٫١١").toString()).toBe("45542.11");
    expect(toMoney("1.500,25").toString()).toBe("1500.25");
    expect(toMoney("250-").toString()).toBe("-250");
    expect(toMoney("ر.س 1,000").toString()).toBe("1000");
    expect(toMoney("د.إ 500").toString()).toBe("500");
    expect(toMoney(".5").toString()).toBe("0.5");
  });

  it("يعيد صفراً للقيم الفارغة أو غير الصالحة", () => {
    expect(toMoney("").toString()).toBe("0");
    expect(toMoney(null).toString()).toBe("0");
    expect(toMoney("نص غير رقمي").toString()).toBe("0");
    expect(money(-0)).toBe(0);
  });
});

describe("ميزان المراجعة", () => {
  const trial = buildTrialBalance(ledger, year);

  it("يتوازن ويحصر 12 قيداً", () => {
    expect(trial.entryCount).toBe(12);
    expect(trial.balanced).toBe(true);
    expect(trial.difference).toBe(0);
    expect(trial.unknownAccounts).toEqual([]);
  });

  it("يساوي مجموع المدين مجموع الدائن", () => {
    expect(trial.totals.debit).toBe(230200);
    expect(trial.totals.credit).toBe(230200);
    expect(trial.totals.closingDebit).toBe(232000);
    expect(trial.totals.closingCredit).toBe(232000);
    expect(trial.totals.openingDebit).toBe(150000);
    expect(trial.totals.openingCredit).toBe(150000);
  });

  it("يعرض أرصدة الحسابات بالاتجاه الصحيح", () => {
    const row = (code: string) => trial.rows.find((item) => item.code === code)!;
    expect(row("1020").closingDebit).toBe(76800);
    expect(row("1100").closingDebit).toBe(10000);
    expect(row("1200").closingDebit).toBe(5000);
    expect(row("2010").closingCredit).toBe(18000);
    expect(row("1590").closingCredit).toBe(2500);
    expect(row("3030").closingDebit).toBe(4000);
  });

  it("يحسب الأرصدة حتى تاريخ محدد", () => {
    const balances = accountBalancesAt(ledger, "2025-03-31");
    expect(balances.get("1100")?.net.toString()).toBe("60000");
    expect(balances.get("1200")?.net.toString()).toBe("-35000");
    expect(balances.get("4010")?.net.toString()).toBe("-60000");
  });
});

describe("قائمة الدخل", () => {
  const income = buildIncomeStatement(ledger, year);

  it("يحسب الإيرادات الصافية بعد المردودات", () => {
    expect(income.revenue).toBe(60000);
    expect(income.salesReturns).toBe(5000);
    expect(income.netRevenue).toBe(55000);
  });

  it("يحسب مجمل الربح والربح التشغيلي", () => {
    expect(income.costOfSales).toBe(35000);
    expect(income.grossProfit).toBe(20000);
    expect(income.adminExpenses).toBe(8000);
    expect(income.marketingExpenses).toBe(3000);
    expect(income.depreciation).toBe(2500);
    expect(income.operatingExpenses).toBe(13500);
    expect(income.operatingProfit).toBe(6500);
  });

  it("يحسب صافي الربح بعد المالية والضريبة", () => {
    expect(income.financeExpenses).toBe(1200);
    expect(income.profitBeforeTax).toBe(5300);
    expect(income.taxExpense).toBe(1500);
    expect(income.netProfit).toBe(3800);
  });

  it("يعزل الفترة: الربع الأول بلا مصروفات تشغيلية", () => {
    const q1 = buildIncomeStatement(ledger, { from: "2025-01-01", to: "2025-03-31" });
    expect(q1.netRevenue).toBe(60000);
    expect(q1.grossProfit).toBe(25000);
    expect(q1.operatingExpenses).toBe(0);
    expect(q1.netProfit).toBe(25000);
    const january = buildIncomeStatement(ledger, { from: "2025-01-01", to: "2025-01-31" });
    expect(january.netRevenue).toBe(0);
    expect(january.netProfit).toBe(0);
  });
});

describe("قائمة المركز المالي", () => {
  const balance = buildBalanceSheet(ledger, { ...year, periodStart: year.from });

  it("يحسب الأصول المتداولة وغير المتداولة", () => {
    expect(balance.cash).toBe(50000);
    expect(balance.bank).toBe(76800);
    expect(balance.receivables).toBe(10000);
    expect(balance.inventory).toBe(5000);
    expect(balance.totalCurrentAssets).toBe(141800);
    expect(balance.fixedAssets).toBe(30000);
    expect(balance.accumulatedDepreciation).toBe(-2500);
    expect(balance.netFixedAssets).toBe(27500);
    expect(balance.totalAssets).toBe(169300);
  });

  it("يحسب الالتزامات وحقوق الملكية", () => {
    expect(balance.payables).toBe(18000);
    expect(balance.taxPayable).toBe(1500);
    expect(balance.totalLiabilities).toBe(19500);
    expect(balance.capital).toBe(130000);
    expect(balance.retainedEarnings).toBe(20000);
    expect(balance.currentPeriodProfit).toBe(3800);
    expect(balance.drawings).toBe(4000);
    expect(balance.totalEquity).toBe(149800);
  });

  it("يحقق معادلة الميزانية: الأصول = الالتزامات + حقوق الملكية", () => {
    expect(balance.totalLiabilitiesAndEquity).toBe(169300);
    expect(balance.balanced).toBe(true);
    expect(balance.difference).toBe(0);
  });

  it("يكشف عدم التوازن عندما لا تُقفل أرباح الفترة السابقة", () => {
    const priorYearSale = entry("p1", "2024-11-01", "مبيعات 2024", [["1100", 10000, 0], ["4010", 0, 10000]]);
    const withPrior = { ...ledger, entries: [...entries, priorYearSale] };
    const result = buildBalanceSheet(withPrior, { ...year, periodStart: year.from });
    expect(result.balanced).toBe(false);
    expect(result.difference).toBe(10000);
    expect(result.warnings.some((warning) => warning.includes("غير متوازنة"))).toBe(true);
  });
});

describe("قائمة التدفقات النقدية", () => {
  const cashFlow = buildCashFlowStatement(ledger, year);

  it("تتوفر عند تحديد الفترة وتتساوى مع التغير الفعلي للنقدية", () => {
    expect(cashFlow.available).toBe(true);
    expect(cashFlow.openingCash).toBe(120000);
    expect(cashFlow.closingCash).toBe(126800);
    expect(cashFlow.operating).toBe(10800);
    expect(cashFlow.investing).toBe(0);
    expect(cashFlow.financing).toBe(-4000);
    expect(cashFlow.netChange).toBe(6800);
    const reconciliation = cashFlow.lines.find((line) => line.key === "reconciliation")!;
    expect(reconciliation.amount).toBe(0);
  });

  it("ترفض الإعداد دون فترة بدل إنتاج أرقام مضللة", () => {
    const result = buildCashFlowStatement(ledger, {});
    expect(result.available).toBe(false);
    expect(result.lines).toEqual([]);
    expect(result.warnings[0]).toContain("يلزم تحديد فترة");
  });
});

describe("قائمة التغيرات في حقوق الملكية", () => {
  const equity = buildEquityStatement(ledger, year);

  it("تربط رأس المال والأرباح والمسحوبات", () => {
    expect(equity.openingCapital).toBe(130000);
    expect(equity.capitalAdditions).toBe(0);
    expect(equity.closingCapital).toBe(130000);
    expect(equity.openingRetained).toBe(20000);
    expect(equity.netProfit).toBe(3800);
    expect(equity.distributions).toBe(4000);
    expect(equity.totalEquity).toBe(149800);
  });

  it("تطابق إجمالي حقوق الملكية في المركز المالي", () => {
    const balance = buildBalanceSheet(ledger, { ...year, periodStart: year.from });
    expect(equity.totalEquity).toBe(balance.totalEquity);
  });
});

describe("النسب المالية", () => {
  const analysis = buildFinancialAnalysis(ledger, year);
  const ratio = (key: string) => analysis.ratios.find((item) => item.key === key)!;

  it("يحسب نسب السيولة والربحية والمديونية", () => {
    expect(ratio("current_ratio").value).toBe(7.27);
    expect(ratio("quick_ratio").value).toBe(7.02);
    expect(ratio("gross_margin").value).toBe(36.36);
    expect(ratio("operating_margin").value).toBe(11.82);
    expect(ratio("net_margin").value).toBe(6.91);
    expect(ratio("debt_ratio").value).toBe(11.52);
    expect(ratio("roa").value).toBe(2.24);
    expect(ratio("roe").value).toBe(2.54);
    expect(ratio("expense_ratio").value).toBe(26.73);
  });

  it("لا يعرض نسب دوران بلا أرصدة افتتاحية كافية", () => {
    expect(ratio("inventory_turnover").available).toBe(false);
    expect(ratio("receivable_turnover").available).toBe(false);
    expect(ratio("inventory_turnover").unavailableReason).toBeTruthy();
  });

  it("يوضح معادلة كل نسبة", () => {
    expect(ratio("current_ratio").formula).toContain("÷");
  });
});

describe("القيود المحاسبية", () => {
  it("يتحقق من توازن القيد متعدد السطور", () => {
    const multi = entry("m1", "2025-05-05", "قيد مركب", [
      ["1100", 1000, 0],
      ["1200", 500, 0],
      ["4010", 0, 1200],
      ["2020", 0, 300],
    ]);
    const totals = entryTotals(multi);
    expect(totals.balanced).toBe(true);
    expect(totals.debit.toString()).toBe("1500");
  });

  it("يكشف القيد غير المتوازن ويرفضه", () => {
    const bad = entry("b1", "2025-05-05", "قيد خاطئ", [["1100", 100, 0], ["4010", 0, 90]]);
    expect(entryTotals(bad).balanced).toBe(false);
    expect(validateEntry(bad, accounts).map((issue) => issue.code)).toContain("UNBALANCED");
  });

  it("يكشف الحساب غير الموجود والمبلغ السالب والسطر الفارغ", () => {
    const bad = entry("b2", "2025-05-05", "قيد بمشاكل", [
      ["9999", 100, 0],
      ["4010", -100, 0],
    ]);
    const codes = validateEntry(bad, accounts).map((issue) => issue.code);
    expect(codes).toContain("UNKNOWN_ACCOUNT");
    expect(codes).toContain("NEGATIVE_AMOUNT");
  });

  it("يكشف السطر بلا حساب", () => {
    const bad = entry("b3", "2025-05-05", "سطر بلا حساب", [["", 100, 0], ["4010", 0, 100]]);
    expect(validateEntry(bad, accounts).map((issue) => issue.code)).toContain("MISSING_ACCOUNT");
  });

  it("يستبعد المسودات والقيود الملغاة من الميزان", () => {
    const draft = entry("d1", "2025-05-05", "مسودة", [["1100", 999999, 0], ["4010", 0, 999999]], { status: "draft" });
    const voided = entry("v1", "2025-05-05", "ملغى", [["1100", 888888, 0], ["4010", 0, 888888]], { status: "void" });
    const trial = buildTrialBalance({ ...ledger, entries: [...entries, draft, voided] }, year);
    expect(trial.totals.closingDebit).toBe(232000);
    expect(trial.entryCount).toBe(12);
  });

  it("لا يجعل قيداً غير متوازن خارج الفترة ميزان الفترة غير متوازن", () => {
    const future = entry("f1", "2026-02-01", "قيد السنة القادمة", [["1100", 100, 0], ["4010", 0, 90]]);
    const trial = buildTrialBalance({ ...ledger, entries: [...entries, future] }, year);
    expect(trial.balanced).toBe(true);
    expect(trial.difference).toBe(0);
  });
});

describe("كشف الأخطاء", () => {
  const findings = detectAuditFindings(ledger, year);
  const codes = findings.map((finding) => finding.code);

  it("لا يطلق إنذارات كاذبة على بيانات سليمة", () => {
    expect(codes).not.toContain("UNBALANCED_ENTRY");
    expect(codes).not.toContain("TRIAL_BALANCE_DIFFERENCE");
    expect(codes).not.toContain("UNKNOWN_ACCOUNT");
    expect(codes).not.toContain("ABNORMAL_BALANCE");
    expect(codes).not.toContain("OPENING_BALANCE_NOT_BALANCED");
    expect(codes).not.toContain("BALANCE_SHEET_IMBALANCE");
  });

  it("يكشف القيد غير المتوازن وفرق الميزان", () => {
    const bad = entry("b1", "2025-05-05", "قيد خاطئ", [["1100", 100, 0], ["4010", 0, 90]]);
    const result = detectAuditFindings({ ...ledger, entries: [...entries, bad] }, year);
    const found = result.map((finding) => finding.code);
    expect(found).toContain("UNBALANCED_ENTRY");
    expect(found).toContain("TRIAL_BALANCE_DIFFERENCE");
    const unbalanced = result.find((finding) => finding.code === "UNBALANCED_ENTRY")!;
    expect(unbalanced.severity).toBe("critical");
    expect(unbalanced.recommendation.length).toBeGreaterThan(10);
  });

  it("يكشف الحساب غير المعرّف", () => {
    const bad = entry("u1", "2025-05-05", "حساب وهمي", [["9999", 100, 0], ["4010", 0, 100]]);
    const result = detectAuditFindings({ ...ledger, entries: [...entries, bad] }, year);
    expect(result.map((finding) => finding.code)).toContain("UNKNOWN_ACCOUNT");
  });

  it("يكشف الرصيد النقدي السالب", () => {
    const overdraw = entry("o1", "2025-10-01", "سحب يزيد عن الرصيد", [["3030", 90000, 0], ["1010", 0, 90000]]);
    const result = detectAuditFindings({ ...ledger, entries: [...entries, overdraw] }, year);
    const cashFinding = result.find((finding) => finding.code === "ABNORMAL_BALANCE" && finding.accountCode === "1010");
    expect(cashFinding?.severity).toBe("critical");
    expect(cashFinding?.title).toContain("سالب");
  });

  it("يكشف رقم القيد المكرر", () => {
    const duplicateNumber = entry("dup1", "2025-06-01", "سداد مورد (نسخة)", [["2010", 25000, 0], ["1020", 0, 25000]], {
      entryNumber: "PY-001",
    });
    const result = detectAuditFindings({ ...ledger, entries: [...entries, duplicateNumber] }, year);
    expect(result.map((finding) => finding.code)).toContain("DUPLICATE_ENTRY_NUMBER");
  });

  it("يكشف الأرصدة الافتتاحية غير المتوازنة", () => {
    const brokenAccounts = accounts.map((item) =>
      item.code === "1010" ? { ...item, openingBalance: "60000" } : item,
    );
    const result = detectAuditFindings({ ...ledger, accounts: brokenAccounts }, year);
    expect(result.map((finding) => finding.code)).toContain("OPENING_BALANCE_NOT_BALANCED");
  });

  it("يكشف اختلاف عملة القيد عن عملة الشركة", () => {
    const usd = entry("usd1", "2025-06-01", "فاتورة بالدولار", [["1200", 1000, 0], ["2010", 0, 1000]], {
      currency: "USD",
    });
    const result = detectAuditFindings({ ...ledger, entries: [...entries, usd] }, year);
    expect(result.map((finding) => finding.code)).toContain("CURRENCY_MISMATCH");
  });

  it("يكشف السطر بلا حساب", () => {
    const bad = entry("noacc", "2025-06-01", "سطر بلا حساب", [["", 500, 0], ["4010", 0, 500]]);
    const result = detectAuditFindings({ ...ledger, entries: [...entries, bad] }, year);
    expect(result.map((finding) => finding.code)).toContain("LINE_WITHOUT_ACCOUNT");
  });
});

describe("القيود المكررة", () => {
  it("يكشف عمليتين متطابقتين برقمين مختلفين", () => {
    const twin = entry("t1", "2025-06-01", "سداد مورد", [["2010", 25000, 0], ["1020", 0, 25000]], {
      entryNumber: "PY-999",
    });
    const groups = detectDuplicates({ ...ledger, entries: [...entries, twin] }, year);
    const match = groups.find((group) => group.entries.some((item) => item.entryNumber === "PY-999"));
    expect(match).toBeTruthy();
    expect(match!.strength).not.toBe("weak");
  });
});

describe("حالات حدية", () => {
  it("يتعامل مع دفتر فارغ دون أخطاء", () => {
    const empty: Ledger = { accounts, entries: [], currency: "SAR" };
    const trial = buildTrialBalance(empty, year);
    const income = buildIncomeStatement(empty, year);
    const balance = buildBalanceSheet(empty, { ...year, periodStart: year.from });
    expect(trial.entryCount).toBe(0);
    expect(trial.difference).toBe(0);
    expect(income.netProfit).toBe(0);
    expect(balance.totalAssets).toBe(150000);
    expect(balance.balanced).toBe(true);
  });

  it("يتجاهل القيود الصفرية في المجاميع ويكشفها كملاحظة", () => {
    const zero = entry("z1", "2025-06-01", "قيد صفري", [["1100", 0, 0], ["4010", 0, 0]]);
    const trial = buildTrialBalance({ ...ledger, entries: [...entries, zero] }, year);
    expect(trial.totals.closingDebit).toBe(232000);
    const result = detectAuditFindings({ ...ledger, entries: [...entries, zero] }, year);
    expect(result.map((finding) => finding.code)).toContain("ZERO_AMOUNT_ENTRY");
  });

  it("يحافظ على دقة المبالغ ذات ثلاث خانات عشرية عند الترحيل", () => {
    const precise = entry("pr1", "2025-06-01", "قيد بكسور", [["1100", "100.005", 0], ["4010", 0, "100.005"]]);
    const trial = buildTrialBalance({ ...ledger, entries: [...entries, precise] }, year);
    expect(trial.balanced).toBe(true);
    expect(trial.totals.debit).toBe(230300.01);
  });
});
