import type { AccountSubtype, AccountType, NormalBalance } from "./types";

export type StatementSection =
  | "current_asset"
  | "non_current_asset"
  | "other_asset"
  | "current_liability"
  | "non_current_liability"
  | "equity"
  | "revenue"
  | "cost_of_sales"
  | "operating_expense"
  | "other_income"
  | "other_expense"
  | "tax";

export interface SubtypeMeta {
  label: string;
  type: AccountType;
  section: StatementSection;
  normalBalance: NormalBalance;
  isContra: boolean;
}

export const SUBTYPE_META: Record<AccountSubtype, SubtypeMeta> = {
  cash: { label: "النقدية", type: "asset", section: "current_asset", normalBalance: "debit", isContra: false },
  bank: { label: "البنك", type: "asset", section: "current_asset", normalBalance: "debit", isContra: false },
  receivable: { label: "العملاء (المدينون)", type: "asset", section: "current_asset", normalBalance: "debit", isContra: false },
  inventory: { label: "المخزون", type: "asset", section: "current_asset", normalBalance: "debit", isContra: false },
  other_current_asset: { label: "أصول متداولة أخرى", type: "asset", section: "current_asset", normalBalance: "debit", isContra: false },
  fixed_asset: { label: "الأصول الثابتة", type: "asset", section: "non_current_asset", normalBalance: "debit", isContra: false },
  accumulated_depreciation: { label: "مجمع الإهلاك", type: "asset", section: "non_current_asset", normalBalance: "credit", isContra: true },
  other_asset: { label: "أصول أخرى", type: "asset", section: "other_asset", normalBalance: "debit", isContra: false },
  other_current_liability: { label: "التزامات متداولة أخرى", type: "liability", section: "current_liability", normalBalance: "credit", isContra: false },
  payable: { label: "الموردون (الدائنون)", type: "liability", section: "current_liability", normalBalance: "credit", isContra: false },
  tax_payable: { label: "ضرائب مستحقة", type: "liability", section: "current_liability", normalBalance: "credit", isContra: false },
  short_term_loan: { label: "قروض قصيرة الأجل", type: "liability", section: "current_liability", normalBalance: "credit", isContra: false },
  long_term_liability: { label: "التزامات طويلة الأجل", type: "liability", section: "non_current_liability", normalBalance: "credit", isContra: false },
  capital: { label: "رأس المال", type: "equity", section: "equity", normalBalance: "credit", isContra: false },
  retained_earnings: { label: "الأرباح المحتجزة", type: "equity", section: "equity", normalBalance: "credit", isContra: false },
  drawings: { label: "المسحوبات والتوزيعات", type: "equity", section: "equity", normalBalance: "debit", isContra: true },
  sales: { label: "إيرادات المبيعات", type: "revenue", section: "revenue", normalBalance: "credit", isContra: false },
  sales_returns: { label: "مردودات ومسموحات المبيعات", type: "revenue", section: "revenue", normalBalance: "debit", isContra: true },
  cost_of_sales: { label: "تكلفة المبيعات", type: "expense", section: "cost_of_sales", normalBalance: "debit", isContra: false },
  operating_expense: { label: "مصروفات تشغيلية", type: "expense", section: "operating_expense", normalBalance: "debit", isContra: false },
  admin_expense: { label: "مصروفات إدارية وعمومية", type: "expense", section: "operating_expense", normalBalance: "debit", isContra: false },
  marketing_expense: { label: "مصروفات تسويقية", type: "expense", section: "operating_expense", normalBalance: "debit", isContra: false },
  finance_expense: { label: "مصروفات مالية", type: "expense", section: "operating_expense", normalBalance: "debit", isContra: false },
  depreciation: { label: "الإهلاك", type: "expense", section: "operating_expense", normalBalance: "debit", isContra: false },
  other_income: { label: "إيرادات أخرى", type: "revenue", section: "other_income", normalBalance: "credit", isContra: false },
  other_expense: { label: "مصروفات أخرى", type: "expense", section: "other_expense", normalBalance: "debit", isContra: false },
  tax_expense: { label: "مصروف الضريبة", type: "expense", section: "tax", normalBalance: "debit", isContra: false },
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: "أصول",
  liability: "التزامات",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};

export function subtypeLabel(subtype: AccountSubtype): string {
  return SUBTYPE_META[subtype]?.label ?? subtype;
}

export function normalBalanceOf(account: { type: AccountType; subtype: AccountSubtype; isContra?: boolean; normalBalance?: NormalBalance }): NormalBalance {
  if (account.normalBalance) return account.normalBalance;
  const meta = SUBTYPE_META[account.subtype];
  if (meta) return meta.normalBalance;
  return account.type === "asset" || account.type === "expense" ? "debit" : "credit";
}

export function isContraAccount(account: { subtype: AccountSubtype; isContra?: boolean }): boolean {
  if (typeof account.isContra === "boolean") return account.isContra;
  return SUBTYPE_META[account.subtype]?.isContra ?? false;
}

export const DEFAULT_ACCOUNT_TYPES = Object.entries(SUBTYPE_META).map(([subtype, meta]) => ({
  subtype: subtype as AccountSubtype,
  ...meta,
}));
