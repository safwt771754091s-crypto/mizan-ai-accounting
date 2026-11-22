export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export type AccountSubtype =
  | "cash"
  | "bank"
  | "receivable"
  | "inventory"
  | "fixed_asset"
  | "accumulated_depreciation"
  | "other_current_asset"
  | "other_current_liability"
  | "other_asset"
  | "payable"
  | "tax_payable"
  | "short_term_loan"
  | "long_term_liability"
  | "capital"
  | "retained_earnings"
  | "drawings"
  | "sales"
  | "sales_returns"
  | "cost_of_sales"
  | "operating_expense"
  | "admin_expense"
  | "marketing_expense"
  | "finance_expense"
  | "depreciation"
  | "other_income"
  | "other_expense"
  | "tax_expense";

export type NormalBalance = "debit" | "credit";

export interface Account {
  id: string;
  companyId?: string;
  code: string;
  name: string;
  nameEn?: string;
  type: AccountType;
  subtype: AccountSubtype;
  parentId?: string | null;
  parentCode?: string | null;
  normalBalance?: NormalBalance;
  isContra?: boolean;
  isActive: boolean;
  level?: number;
  openingBalance?: string | number;
  openingBalanceType?: NormalBalance;
  currency?: string;
}

export type JournalEntryStatus = "draft" | "posted" | "void";

export interface JournalEntryLine {
  id?: string;
  entryId?: string;
  accountId?: string;
  accountCode: string;
  debit: string | number;
  credit: string | number;
  description?: string;
  costCenter?: string | null;
  branch?: string | null;
  taxCode?: string | null;
  documentRef?: string | null;
}

export interface JournalEntry {
  id: string;
  companyId?: string;
  entryNumber: string;
  date: string;
  description: string;
  reference?: string | null;
  source: string;
  status: JournalEntryStatus;
  currency?: string;
  exchangeRate?: string | number;
  periodId?: string | null;
  createdAt?: string;
  lines: JournalEntryLine[];
}

export interface AccountingPeriod {
  id: string;
  companyId?: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed" | "locked";
}

export interface Ledger {
  accounts: Account[];
  entries: JournalEntry[];
  periods?: AccountingPeriod[];
  currency: string;
}

export interface DateRange {
  from?: string;
  to?: string;
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  openingDebit: number;
  openingCredit: number;
  debit: number;
  credit: number;
  closingDebit: number;
  closingCredit: number;
  netBalance: number;
  netBalanceSide: NormalBalance | "zero";
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totals: {
    openingDebit: number;
    openingCredit: number;
    debit: number;
    credit: number;
    closingDebit: number;
    closingCredit: number;
  };
  balanced: boolean;
  difference: number;
  from?: string;
  to?: string;
  entryCount: number;
  unknownAccounts?: string[];
}

export interface StatementLine {
  key: string;
  label: string;
  amount: number;
  level: number;
  isTotal?: boolean;
  isHeader?: boolean;
  note?: string;
  accountCodes?: string[];
}

export interface IncomeStatement {
  lines: StatementLine[];
  revenue: number;
  salesReturns: number;
  netRevenue: number;
  costOfSales: number;
  grossProfit: number;
  operatingExpenses: number;
  adminExpenses: number;
  marketingExpenses: number;
  depreciation: number;
  financeExpenses: number;
  operatingProfit: number;
  otherIncome: number;
  otherExpenses: number;
  profitBeforeTax: number;
  taxExpense: number;
  netProfit: number;
  warnings: string[];
  currency: string;
  from?: string;
  to?: string;
}

export interface BalanceSheet {
  lines: StatementLine[];
  currentAssets: number;
  cash: number;
  bank: number;
  receivables: number;
  inventory: number;
  otherCurrentAssets: number;
  totalCurrentAssets: number;
  fixedAssets: number;
  accumulatedDepreciation: number;
  netFixedAssets: number;
  otherAssets: number;
  totalAssets: number;
  currentLiabilities: number;
  payables: number;
  taxPayable: number;
  shortTermLoans: number;
  otherCurrentLiabilities: number;
  totalCurrentLiabilities: number;
  longTermLiabilities: number;
  totalLiabilities: number;
  capital: number;
  retainedEarnings: number;
  currentPeriodProfit: number;
  drawings: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  balanced: boolean;
  difference: number;
  warnings: string[];
  currency: string;
  asOf: string;
}

export interface CashFlowStatement {
  lines: StatementLine[];
  operating: number;
  investing: number;
  financing: number;
  netChange: number;
  openingCash: number;
  closingCash: number;
  method: "indirect";
  warnings: string[];
  currency: string;
  from?: string;
  to?: string;
  available: boolean;
}

export interface EquityStatement {
  lines: StatementLine[];
  openingCapital: number;
  capitalAdditions: number;
  openingRetained: number;
  netProfit: number;
  drawings: number;
  distributions: number;
  closingCapital: number;
  closingRetained: number;
  totalEquity: number;
  warnings: string[];
  currency: string;
  from?: string;
  to?: string;
}

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface AuditFinding {
  id: string;
  code: string;
  title: string;
  description: string;
  severity: Severity;
  category:
    | "balance"
    | "chart_of_accounts"
    | "classification"
    | "abnormal_balance"
    | "missing_data"
    | "period"
    | "posting"
    | "documentation"
    | "duplicate"
    | "anomaly";
  accountCode?: string | null;
  accountName?: string | null;
  entryNumber?: string | null;
  entryId?: string | null;
  source?: string | null;
  amount?: number | null;
  reason: string;
  recommendation: string;
  confidence: number;
  status: "open" | "reviewed" | "dismissed";
  detectedAt: string;
  evidence?: Record<string, string | number | null>;
}

export interface DuplicateGroup {
  id: string;
  kind: "journal_entry" | "invoice" | "voucher" | "purchase" | "sale" | "expense";
  strength: "strong" | "medium" | "weak";
  score: number;
  entries: Array<{
    entryId: string;
    entryNumber: string;
    date: string;
    description: string;
    amount: number;
    reference?: string | null;
    supplier?: string | null;
  }>;
  reasons: string[];
  recommendation: string;
}

export interface AnomalyResult {
  id: string;
  title: string;
  description: string;
  category:
    | "expense_spike"
    | "unusual_expense"
    | "repeated_amount"
    | "outlier"
    | "ratio_shift"
    | "documentation"
    | "concentration";
  severity: Severity;
  score: number;
  amount: number;
  accountCode?: string | null;
  accountName?: string | null;
  period?: string | null;
  reasons: string[];
  evidence: Array<{ label: string; value: string }>;
}

export interface RatioResult {
  key: string;
  label: string;
  value: number | null;
  unit: "ratio" | "percent" | "times" | "days";
  formula: string;
  interpretation: string;
  available: boolean;
  unavailableReason?: string;
  benchmark?: string;
}

export interface FinancialAnalysis {
  ratios: RatioResult[];
  revenueChange: number | null;
  expenseChange: number | null;
  profitChange: number | null;
  monthly: Array<{ period: string; revenue: number; expenses: number; profit: number }>;
  expenseBreakdown: Array<{ code: string; name: string; amount: number; share: number }>;
  warnings: string[];
  from?: string;
  to?: string;
  currency: string;
}
