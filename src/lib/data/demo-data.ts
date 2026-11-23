import type { Account, AccountingPeriod, JournalEntry } from "@/lib/accounting/types";
import type { Company, CompanyData, DemoStore } from "./types";
import type { ImportedRecord } from "./types";
import type { ImportBatchRecord } from "@/lib/import/types";
import { hashPassword } from "../auth/password";

interface AccountSeed {
  code: string;
  name: string;
  type: Account["type"];
  subtype: Account["subtype"];
  isContra?: boolean;
}

const CHART: AccountSeed[] = [
  { code: "1010", name: "الصندوق - نقدية", type: "asset", subtype: "cash" },
  { code: "1020", name: "البنك الأهلي", type: "asset", subtype: "bank" },
  { code: "1030", name: "العملاء (المدينون)", type: "asset", subtype: "receivable" },
  { code: "1040", name: "المخزون", type: "asset", subtype: "inventory" },
  { code: "1050", name: "مصروفات مدفوعة مقدماً", type: "asset", subtype: "other_current_asset" },
  { code: "1210", name: "الأصول الثابتة", type: "asset", subtype: "fixed_asset" },
  { code: "1220", name: "مجمع إهلاك الأصول الثابتة", type: "asset", subtype: "accumulated_depreciation", isContra: true },
  { code: "1310", name: "أصول غير ملموسة", type: "asset", subtype: "other_asset" },
  { code: "2010", name: "الموردون (الدائنون)", type: "liability", subtype: "payable" },
  { code: "2020", name: "ضريبة القيمة المضافة المستحقة", type: "liability", subtype: "tax_payable" },
  { code: "2030", name: "قروض قصيرة الأجل", type: "liability", subtype: "short_term_loan" },
  { code: "2040", name: "مصروفات مستحقة", type: "liability", subtype: "other_current_liability" },
  { code: "2110", name: "قروض طويلة الأجل", type: "liability", subtype: "long_term_liability" },
  { code: "3010", name: "رأس المال", type: "equity", subtype: "capital" },
  { code: "3020", name: "الأرباح المحتجزة", type: "equity", subtype: "retained_earnings" },
  { code: "3030", name: "المسحوبات والتوزيعات", type: "equity", subtype: "drawings", isContra: true },
  { code: "4010", name: "إيرادات المبيعات", type: "revenue", subtype: "sales" },
  { code: "4020", name: "مردودات ومسموحات المبيعات", type: "revenue", subtype: "sales_returns", isContra: true },
  { code: "4030", name: "إيرادات أخرى", type: "revenue", subtype: "other_income" },
  { code: "5010", name: "تكلفة المبيعات", type: "expense", subtype: "cost_of_sales" },
  { code: "6010", name: "الرواتب والأجور", type: "expense", subtype: "admin_expense" },
  { code: "6020", name: "الإيجارات", type: "expense", subtype: "admin_expense" },
  { code: "6030", name: "المرافق والخدمات", type: "expense", subtype: "operating_expense" },
  { code: "6040", name: "التسويق والإعلان", type: "expense", subtype: "marketing_expense" },
  { code: "6050", name: "الإهلاك", type: "expense", subtype: "depreciation" },
  { code: "6060", name: "أتعاب مهنية", type: "expense", subtype: "admin_expense" },
  { code: "6070", name: "صيانة وتصليحات", type: "expense", subtype: "operating_expense" },
  { code: "7010", name: "مصروفات مالية", type: "expense", subtype: "finance_expense" },
  { code: "8010", name: "مصروف ضريبة الدخل", type: "expense", subtype: "tax_expense" },
];

export function buildChart(companyId: string): Account[] {
  return CHART.map((seed) => ({
    id: `acc-${companyId}-${seed.code}`,
    companyId,
    code: seed.code,
    name: seed.name,
    type: seed.type,
    subtype: seed.subtype,
    isContra: seed.isContra,
    isActive: true,
  }));
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DemoConfig {
  companyId: string;
  year: number;
  currency: string;
  seed: number;
  baseMonthlySales: number;
  cogsRate: number;
  salaries: number;
  rent: number;
  utilities: number;
  marketing: number;
  marketingSpikeMonth?: number;
  marketingSpikeAmount?: number;
  finance: number;
  depreciation: number;
  taxPerQuarter: number;
  drawingsPerQuarter: number;
  cashDepositRate: number;
  collectionRate: number;
  paymentRate: number;
  opening: {
    cash: number;
    bank: number;
    receivables: number;
    inventory: number;
    prepaid: number;
    fixedAssets: number;
    accumulatedDepreciation: number;
    payables: number;
    taxPayable: number;
    shortLoan: number;
    longLoan: number;
    capital: number;
    retained: number;
  };
  withIssues?: boolean;
}

interface DraftLine {
  code: string;
  debit?: number;
  credit?: number;
  description?: string;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function makeEntries(config: DemoConfig): JournalEntry[] {
  const entries: JournalEntry[] = [];
  const random = mulberry32(config.seed);
  const { companyId, year, currency: companyCurrency, opening } = config;

  const push = (
    key: string,
    entryNumber: string,
    date: string,
    description: string,
    lines: DraftLine[],
    extra: Partial<JournalEntry> = {},
  ) => {
    entries.push({
      id: `je-${companyId}-${key}`,
      companyId,
      entryNumber,
      date,
      description,
      source: extra.source ?? "manual",
      status: extra.status ?? "posted",
      currency: extra.currency ?? companyCurrency,
      reference: extra.reference ?? null,
      ...extra,
      lines: lines.map((line, index) => ({
        id: `jl-${companyId}-${key}-${index}`,
        entryId: `je-${companyId}-${key}`,
        accountCode: line.code,
        debit: round(line.debit ?? 0),
        credit: round(line.credit ?? 0),
        description: line.description ?? description,
      })),
    });
  };

  push(
    "opening",
    "OP-0001",
    `${year - 1}-12-31`,
    "أرصدة افتتاحية للسنة المالية",
    [
      { code: "1010", debit: opening.cash },
      { code: "1020", debit: opening.bank },
      { code: "1030", debit: opening.receivables },
      { code: "1040", debit: opening.inventory },
      { code: "1050", debit: opening.prepaid },
      { code: "1210", debit: opening.fixedAssets },
      { code: "1220", credit: opening.accumulatedDepreciation },
      { code: "2010", credit: opening.payables },
      { code: "2020", credit: opening.taxPayable },
      { code: "2030", credit: opening.shortLoan },
      { code: "2110", credit: opening.longLoan },
      { code: "3010", credit: opening.capital },
      { code: "3020", credit: opening.retained },
    ],
    { source: "opening", reference: `OP-${year}` },
  );

  const monthNames = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];

  for (let month = 1; month <= 12; month += 1) {
    const mm = String(month).padStart(2, "0");
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const date = `${year}-${mm}-${String(Math.min(28, lastDay)).padStart(2, "0")}`;
    const label = monthNames[month - 1];

    const seasonal = 1 + Math.sin((month / 12) * Math.PI * 2) * 0.12;
    const noise = 0.92 + random() * 0.16;
    const sales = round(config.baseMonthlySales * seasonal * noise);
    const cashSales = round(sales * 0.4);
    const creditSales = round(sales - cashSales);
    const cogs = round(sales * config.cogsRate);
    const purchases = round(cogs * 1.04);

    push(
      `sales-cash-${mm}`,
      `SAL-${year}-${mm}-01`,
      date,
      `مبيعات نقدية - ${label} ${year}`,
      [
        { code: "1010", debit: cashSales },
        { code: "4010", credit: cashSales },
      ],
      { source: "sales", reference: `CS-${year}${mm}-01` },
    );

    push(
      `sales-credit-${mm}`,
      `SAL-${year}-${mm}-02`,
      date,
      `مبيعات آجلة - ${label} ${year}`,
      [
        { code: "1030", debit: creditSales },
        { code: "4010", credit: creditSales },
      ],
      { source: "sales", reference: `INV-${year}${mm}-02` },
    );

    push(
      `cogs-${mm}`,
      `COGS-${year}-${mm}`,
      date,
      `تكلفة المبيعات - ${label} ${year}`,
      [
        { code: "5010", debit: cogs },
        { code: "1040", credit: cogs },
      ],
      { source: "cogs" },
    );

    push(
      `purchases-${mm}`,
      `PUR-${year}-${mm}`,
      date,
      `مشتريات مخزون - ${label} ${year}`,
      [
        { code: "1040", debit: purchases },
        { code: "2010", credit: purchases },
      ],
      { source: "purchase", reference: `PUR-${year}-${mm}-100` },
    );

    const collections = round(creditSales * config.collectionRate);
    push(
      `collections-${mm}`,
      `COL-${year}-${mm}`,
      date,
      `تحصيلات من العملاء - ${label} ${year}`,
      [
        { code: "1020", debit: collections },
        { code: "1030", credit: collections },
      ],
      { source: "collection" },
    );

    const payments = round(purchases * config.paymentRate);
    push(
      `supplier-payment-${mm}`,
      `PMT-${year}-${mm}`,
      date,
      `سداد موردين - ${label} ${year}`,
      [
        { code: "2010", debit: payments },
        { code: "1020", credit: payments },
      ],
      { source: "payment" },
    );

    push(
      `salaries-${mm}`,
      `PAY-${year}-${mm}`,
      date,
      `رواتب وأجور - ${label} ${year}`,
      [
        { code: "6010", debit: config.salaries },
        { code: "1020", credit: config.salaries },
      ],
      { source: "payroll", reference: `PAY-${year}${mm}` },
    );

    push(
      `rent-${mm}`,
      `RNT-${year}-${mm}`,
      date,
      `إيجار المقر - ${label} ${year}`,
      [
        { code: "6020", debit: config.rent },
        { code: "1020", credit: config.rent },
      ],
      { source: "expense", reference: `RNT-${year}${mm}` },
    );

    push(
      `utilities-${mm}`,
      `UTL-${year}-${mm}`,
      date,
      `كهرباء ومياه واتصالات - ${label} ${year}`,
      [
        { code: "6030", debit: config.utilities },
        { code: "1010", credit: config.utilities },
      ],
      { source: "expense", reference: `UTL-${year}${mm}` },
    );

    const marketing =
      config.marketingSpikeMonth === month && config.marketingSpikeAmount
        ? config.marketingSpikeAmount
        : config.marketing;
    push(
      `marketing-${mm}`,
      `MKT-${year}-${mm}`,
      date,
      config.marketingSpikeMonth === month ? `حملة تسويقية موسعة - ${label} ${year}` : `تسويق وإعلان - ${label} ${year}`,
      [
        { code: "6040", debit: marketing },
        { code: "1020", credit: marketing },
      ],
      { source: "expense", reference: config.marketingSpikeMonth === month ? undefined : `MKT-${year}${mm}` },
    );

    push(
      `finance-${mm}`,
      `FIN-${year}-${mm}`,
      date,
      `فوائد وأعباء تمويلية - ${label} ${year}`,
      [
        { code: "7010", debit: config.finance },
        { code: "1020", credit: config.finance },
      ],
      { source: "expense" },
    );

    push(
      `depreciation-${mm}`,
      `DEP-${year}-${mm}`,
      date,
      `إهلاك شهري - ${label} ${year}`,
      [
        { code: "6050", debit: config.depreciation },
        { code: "1220", credit: config.depreciation },
      ],
      { source: "depreciation" },
    );

    const deposit = round(cashSales * config.cashDepositRate);
    push(
      `deposit-${mm}`,
      `DPT-${year}-${mm}`,
      date,
      `إيداع نقدية في البنك - ${label} ${year}`,
      [
        { code: "1020", debit: deposit },
        { code: "1010", credit: deposit },
      ],
      { source: "transfer" },
    );

    if (month % 3 === 0) {
      push(
        `tax-${mm}`,
        `TAX-${year}-${mm}`,
        date,
        `ضريبة دخل مستحقة - الربع ${month / 3}`,
        [
          { code: "8010", debit: config.taxPerQuarter },
          { code: "2020", credit: config.taxPerQuarter },
        ],
        { source: "tax" },
      );
      push(
        `drawings-${mm}`,
        `DRW-${year}-${mm}`,
        date,
        `مسحوبات الشريك - الربع ${month / 3}`,
        [
          { code: "3030", debit: config.drawingsPerQuarter },
          { code: "1020", credit: config.drawingsPerQuarter },
        ],
        { source: "drawings" },
      );
    }

    if (month === 4 || month === 9) {
      push(
        `maintenance-${mm}`,
        `MNT-${year}-${mm}`,
        date,
        `صيانة دورية للمقر - ${label} ${year}`,
        [
          { code: "6070", debit: 9500 },
          { code: "1010", credit: 9500 },
        ],
        { source: "expense", reference: `MNT-${year}${mm}` },
      );
    }

    if (month === 2) {
      push(
        `returns-${mm}`,
        `RET-${year}-${mm}`,
        date,
        "مردودات مبيعات - عميل",
        [
          { code: "4020", debit: 6500 },
          { code: "1030", credit: 6500 },
        ],
        { source: "sales_return", reference: `CN-${year}-002` },
      );
    }

    if (month === 11) {
      push(
        `professional-${mm}`,
        `PRO-${year}-${mm}`,
        date,
        "أتعاب استشارات قانونية ومحاسبية",
        [
          { code: "6060", debit: 38000 },
          { code: "1020", credit: 38000 },
        ],
        { source: "expense" },
      );
    }
  }

  // فاتورة مشتريات مكررة (اشتباه قوي) — لا تُحذف ولا تُعدّل تلقائياً
  push(
    "duplicate-purchase",
    "PUR-2025-07-DUP",
    `${year}-07-15`,
    "مشتريات مخزون - يوليو (نسخة)",
    [
      { code: "1040", debit: 41250 },
      { code: "2010", credit: 41250 },
    ],
    { source: "purchase", reference: `PUR-${year}-07-100` },
  );

  if (config.withIssues) {
    push(
      "unbalanced",
      "ERR-0001",
      `${year}-08-20`,
      "قيد غير متوازن - يحتاج مراجعة",
      [
        { code: "6070", debit: 5000 },
        { code: "1010", credit: 4500 },
      ],
      { source: "manual" },
    );
    push(
      "unknown-account",
      "ERR-0002",
      `${year}-08-21`,
      "قيد على حساب غير معرّف",
      [
        { code: "9999", debit: 2500 },
        { code: "4010", credit: 2500 },
      ],
      { source: "manual" },
    );
  }

  return entries;
}

function periods(companyId: string, year: number): AccountingPeriod[] {
  return [
    {
      id: `period-${companyId}-${year}`,
      companyId,
      name: `السنة المالية ${year}`,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      status: "open",
    },
  ];
}

export function buildDemoCompanies(): Company[] {
  return [
    {
      id: "co-nakheel",
      name: "شركة النخيل للتجارة",
      legalName: "شركة النخيل للتجارة المحدودة",
      activityType: "تجارة التجزئة والجملة",
      country: "SA",
      currency: "SAR",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
      entityType: "شركة ذات مسؤولية محدودة",
      status: "active",
      taxNumber: "300123456700003",
      registrationNumber: "1010456789",
      phone: "0112345678",
      email: "finance@nakheel.example",
      city: "الرياض",
      address: "طريق الملك فهد، الرياض",
      notes: "شركة تجارية متعددة الفروع — بيانات تجريبية للعرض.",
      createdAt: "2025-01-02T08:00:00.000Z",
      createdBy: "user-demo",
    },
    {
      id: "co-ufuq",
      name: "مؤسسة الأفق للمقاولات",
      legalName: "مؤسسة الأفق للمقاولات العامة",
      activityType: "مقاولات وإنشاءات",
      country: "AE",
      currency: "AED",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
      entityType: "مؤسسة فردية",
      status: "active",
      taxNumber: "100456789100003",
      registrationNumber: "CN-998877",
      phone: "042345678",
      email: "accounts@ufuq.example",
      city: "دبي",
      address: "المنطقة الصناعية، دبي",
      notes: "مؤسسة مقاولات — بيانات تجريبية.",
      createdAt: "2025-02-11T09:30:00.000Z",
      createdBy: "user-demo",
    },
    {
      id: "co-rakaz",
      name: "متجر ركاز",
      legalName: "متجر ركاز للأجهزة المكتبية",
      activityType: "تجارة تجزئة",
      country: "SA",
      currency: "SAR",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
      entityType: "منشأة فردية",
      status: "active",
      taxNumber: "300987654300003",
      phone: "0556677889",
      email: "owner@rakaz-store.example",
      city: "جدة",
      address: "شارع التحلية، جدة",
      notes: "بيانات تجريبية تحتوي على أخطاء مقصودة لاختبار وحدة الفحص.",
      createdAt: "2025-03-05T12:00:00.000Z",
      createdBy: "user-demo",
    },
  ];
}

export function buildDemoData(): Record<string, CompanyData> {
  const nakheel: CompanyData = {
    accounts: buildChart("co-nakheel"),
    entries: makeEntries({
      companyId: "co-nakheel",
      year: 2025,
      currency: "SAR",
      seed: 20250101,
      baseMonthlySales: 180000,
      cogsRate: 0.55,
      salaries: 35000,
      rent: 12000,
      utilities: 3200,
      marketing: 6000,
      marketingSpikeMonth: 9,
      marketingSpikeAmount: 42000,
      finance: 2200,
      depreciation: 7500,
      taxPerQuarter: 9000,
      drawingsPerQuarter: 20000,
      cashDepositRate: 0.94,
      collectionRate: 0.85,
      paymentRate: 0.75,
      opening: {
        cash: 60000,
        bank: 1200000,
        receivables: 310000,
        inventory: 420000,
        prepaid: 45000,
        fixedAssets: 1450000,
        accumulatedDepreciation: 380000,
        payables: 260000,
        taxPayable: 35000,
        shortLoan: 150000,
        longLoan: 400000,
        capital: 1500000,
        retained: 760000,
      },
    }),
    periods: periods("co-nakheel", 2025),
    batches: [],
    records: [],
    findingStates: [],
    logs: [],
  };

  const ufuq: CompanyData = {
    accounts: buildChart("co-ufuq"),
    entries: makeEntries({
      companyId: "co-ufuq",
      year: 2025,
      currency: "AED",
      seed: 777001,
      baseMonthlySales: 95000,
      cogsRate: 0.62,
      salaries: 28000,
      rent: 9000,
      utilities: 2100,
      marketing: 3000,
      finance: 1500,
      depreciation: 5200,
      taxPerQuarter: 4500,
      drawingsPerQuarter: 12000,
      cashDepositRate: 0.9,
      collectionRate: 0.8,
      paymentRate: 0.72,
      opening: {
        cash: 35000,
        bank: 420000,
        receivables: 180000,
        inventory: 210000,
        prepaid: 22000,
        fixedAssets: 890000,
        accumulatedDepreciation: 210000,
        payables: 140000,
        taxPayable: 18000,
        shortLoan: 80000,
        longLoan: 220000,
        capital: 700000,
        retained: 389000,
      },
    }),
    periods: periods("co-ufuq", 2025),
    batches: [],
    records: [],
    findingStates: [],
    logs: [],
  };

  const rakazStore: CompanyData = {
    accounts: buildChart("co-rakaz"),
    entries: makeEntries({
      companyId: "co-rakaz",
      year: 2025,
      currency: "SAR",
      seed: 99003,
      baseMonthlySales: 42000,
      cogsRate: 0.6,
      salaries: 12000,
      rent: 4500,
      utilities: 900,
      marketing: 1500,
      finance: 400,
      depreciation: 1200,
      taxPerQuarter: 1500,
      drawingsPerQuarter: 5000,
      cashDepositRate: 0.9,
      collectionRate: 0.75,
      paymentRate: 0.7,
      withIssues: true,
      opening: {
        cash: 18000,
        bank: 95000,
        receivables: 52000,
        inventory: 78000,
        prepaid: 6000,
        fixedAssets: 160000,
        accumulatedDepreciation: 48000,
        payables: 46000,
        taxPayable: 7000,
        shortLoan: 25000,
        longLoan: 60000,
        capital: 150000,
        retained: 73000,
      },
    }),
    periods: periods("co-rakaz", 2025),
    batches: [],
    records: [],
    findingStates: [],
    logs: [],
  };

  return { "co-nakheel": nakheel, "co-ufuq": ufuq, "co-rakaz": rakazStore };
}

function seedBatches(): { batches: Record<string, ImportBatchRecord[]>; records: Record<string, ImportedRecord[]> } {
  const batchId = "batch-nakheel-001";
  const batches: Record<string, ImportBatchRecord[]> = {
    "co-nakheel": [
      {
        id: batchId,
        companyId: "co-nakheel",
        fileName: "ميزان-المراجعة-2025.xlsx",
        fileKind: "xlsx",
        sizeBytes: 28450,
        checksum: "demo-checksum-001",
        dataset: "trial_balance",
        sheetName: "ميزان المراجعة",
        mapping: { accountCode: 0, accountName: 1, debit: 2, credit: 3 },
        rowCount: 12,
        importedCount: 12,
        skippedCount: 0,
        errorCount: 0,
        warningCount: 1,
        status: "completed",
        createdAt: "2025-04-02T10:15:00.000Z",
        createdBy: "user-demo",
        issues: [],
        warnings: ["تم تصنيف حسابين تصنيفاً تقديرياً. راجع التصنيف."],
      },
      {
        id: "batch-nakheel-002",
        companyId: "co-nakheel",
        fileName: "مبيعات-الربع-الثاني.csv",
        fileKind: "csv",
        sizeBytes: 15420,
        checksum: "demo-checksum-002",
        dataset: "sales",
        sheetName: "CSV",
        mapping: { date: 0, reference: 1, description: 2, amount: 3 },
        rowCount: 40,
        importedCount: 39,
        skippedCount: 1,
        errorCount: 0,
        warningCount: 2,
        status: "partial",
        createdAt: "2025-07-05T13:40:00.000Z",
        createdBy: "user-demo",
        issues: [
          {
            row: 14,
            code: "DUPLICATE_ROW",
            message: "الصف 14 يبدو مكرراً للصف 13 داخل الملف نفسه.",
            level: "warning",
          },
        ],
        warnings: ["لم يتم تحديد الحسابات المدينة والدائنة، حُفظت البيانات كسجلات فقط."],
      },
    ],
  };

  const records: Record<string, ImportedRecord[]> = {
    "co-nakheel": Array.from({ length: 5 }).map((_, index) => ({
      id: `rec-nakheel-${index + 1}`,
      companyId: "co-nakheel",
      batchId,
      dataset: "trial_balance",
      rowNumber: index + 2,
      data: {
        accountCode: CHART[index].code,
        accountName: CHART[index].name,
        debit: ["60000", "1200000", "310000", "420000", "45000"][index],
        credit: "0",
      },
      createdAt: "2025-04-02T10:15:00.000Z",
    })),
  };

  return { batches, records };
}

export async function buildDemoStore(): Promise<DemoStore> {
  const companies = buildDemoCompanies();
  const data = buildDemoData();
  const seeded = seedBatches();
  data["co-nakheel"].batches = seeded.batches["co-nakheel"];
  data["co-nakheel"].records = seeded.records["co-nakheel"];

  const demoHash = await hashPassword("Demo1234!");
  const adminHash = await hashPassword("Admin1234!");

  return {
    version: 1,
    users: [
      {
        id: "user-demo",
        email: "demo@rakaz.ai",
        fullName: "أحمد المحاسب",
        isSuperAdmin: false,
        createdAt: "2025-01-01T00:00:00.000Z",
        passwordHash: demoHash,
      },
      {
        id: "user-auditor",
        email: "auditor@rakaz.ai",
        fullName: "سارة المراجعة",
        isSuperAdmin: false,
        createdAt: "2025-01-05T00:00:00.000Z",
        passwordHash: demoHash,
      },
      {
        id: "user-viewer",
        email: "viewer@rakaz.ai",
        fullName: "خالد المدير",
        isSuperAdmin: false,
        createdAt: "2025-01-06T00:00:00.000Z",
        passwordHash: demoHash,
      },
      {
        id: "user-admin",
        email: "admin@rakaz.ai",
        fullName: "مدير المنصة",
        isSuperAdmin: true,
        createdAt: "2025-01-01T00:00:00.000Z",
        passwordHash: adminHash,
      },
    ],
    companies,
    members: [
      { id: "m1", companyId: "co-nakheel", userId: "user-demo", role: "owner", createdAt: "2025-01-02T08:00:00.000Z" },
      { id: "m2", companyId: "co-ufuq", userId: "user-demo", role: "owner", createdAt: "2025-02-11T09:30:00.000Z" },
      { id: "m3", companyId: "co-rakaz", userId: "user-demo", role: "admin", createdAt: "2025-03-05T12:00:00.000Z" },
      { id: "m4", companyId: "co-nakheel", userId: "user-auditor", role: "auditor", createdAt: "2025-01-05T00:00:00.000Z" },
      { id: "m5", companyId: "co-nakheel", userId: "user-viewer", role: "viewer", createdAt: "2025-01-06T00:00:00.000Z" },
    ],
    roles: [],
    audit: [],
    proposals: [],
    data,
    activity: [
      {
        id: "log-1",
        companyId: "co-nakheel",
        userId: "user-demo",
        action: "create_company",
        entity: "company",
        entityId: "co-nakheel",
        meta: { name: "شركة النخيل للتجارة" },
        createdAt: "2025-01-02T08:00:00.000Z",
      },
      {
        id: "log-2",
        companyId: "co-nakheel",
        userId: "user-demo",
        action: "import_completed",
        entity: "import_batch",
        entityId: "batch-nakheel-001",
        meta: { rows: 12, dataset: "trial_balance" },
        createdAt: "2025-04-02T10:15:00.000Z",
      },
    ],
  };
}
