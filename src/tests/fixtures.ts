import type { Account, JournalEntry, Ledger } from "@/lib/accounting/types";

export const testAccounts: Account[] = [
  { id: "a1", code: "1010", name: "النقدية", type: "asset", subtype: "cash", isActive: true },
  { id: "a2", code: "1030", name: "العملاء", type: "asset", subtype: "receivable", isActive: true },
  { id: "a3", code: "1040", name: "المخزون", type: "asset", subtype: "inventory", isActive: true },
  { id: "a4", code: "1210", name: "الأصول الثابتة", type: "asset", subtype: "fixed_asset", isActive: true },
  { id: "a5", code: "1220", name: "مجمع الإهلاك", type: "asset", subtype: "accumulated_depreciation", isActive: true, isContra: true },
  { id: "a6", code: "2010", name: "الموردون", type: "liability", subtype: "payable", isActive: true },
  { id: "a7", code: "2020", name: "ضرائب مستحقة", type: "liability", subtype: "tax_payable", isActive: true },
  { id: "a8", code: "3010", name: "رأس المال", type: "equity", subtype: "capital", isActive: true },
  { id: "a9", code: "3020", name: "الأرباح المحتجزة", type: "equity", subtype: "retained_earnings", isActive: true },
  { id: "a10", code: "3030", name: "المسحوبات", type: "equity", subtype: "drawings", isActive: true, isContra: true },
  { id: "a11", code: "4010", name: "المبيعات", type: "revenue", subtype: "sales", isActive: true },
  { id: "a12", code: "4020", name: "مردودات المبيعات", type: "revenue", subtype: "sales_returns", isActive: true, isContra: true },
  { id: "a13", code: "5010", name: "تكلفة المبيعات", type: "expense", subtype: "cost_of_sales", isActive: true },
  { id: "a14", code: "6010", name: "الرواتب", type: "expense", subtype: "admin_expense", isActive: true },
  { id: "a15", code: "6020", name: "الإيجار", type: "expense", subtype: "admin_expense", isActive: true },
  { id: "a16", code: "6050", name: "الإهلاك", type: "expense", subtype: "depreciation", isActive: true },
  { id: "a17", code: "7010", name: "مصروفات مالية", type: "expense", subtype: "finance_expense", isActive: true },
  { id: "a18", code: "8010", name: "مصروف الضريبة", type: "expense", subtype: "tax_expense", isActive: true },
];

function entry(
  id: string,
  entryNumber: string,
  date: string,
  description: string,
  lines: Array<{ code: string; debit?: number; credit?: number; description?: string }>,
  extra: Partial<JournalEntry> = {},
): JournalEntry {
  return {
    id,
    entryNumber,
    date,
    description,
    source: "manual",
    status: "posted",
    currency: "SAR",
    ...extra,
    lines: lines.map((line, index) => ({
      id: `${id}-l${index}`,
      entryId: id,
      accountCode: line.code,
      debit: line.debit ?? 0,
      credit: line.credit ?? 0,
      description: line.description ?? description,
    })),
  };
}

export const testEntries: JournalEntry[] = [
  entry("e0", "OP-001", "2024-12-31", "أرصدة افتتاحية", [
    { code: "1010", debit: 100000 },
    { code: "1040", debit: 150000 },
    { code: "1210", debit: 200000 },
    { code: "1220", credit: 40000 },
    { code: "2010", credit: 60000 },
    { code: "3010", credit: 250000 },
    { code: "3020", credit: 100000 },
  ], { reference: "OP-2025" }),
  entry("e1", "INV-001", "2025-01-15", "مبيعات آجلة - عميل أ", [
    { code: "1030", debit: 120000 },
    { code: "4010", credit: 120000 },
  ], { reference: "INV-2025-001", source: "sales" }),
  entry("e2", "COGS-001", "2025-01-15", "تكلفة المبيعات", [
    { code: "5010", debit: 72000 },
    { code: "1040", credit: 72000 },
  ]),
  entry("e3", "RCV-001", "2025-02-01", "تحصيل من عميل أ", [
    { code: "1010", debit: 90000 },
    { code: "1030", credit: 90000 },
  ]),
  entry("e4", "PAY-001", "2025-02-10", "رواتب يناير", [
    { code: "6010", debit: 30000 },
    { code: "1010", credit: 30000 },
  ]),
  entry("e5", "PAY-002", "2025-03-01", "إيجار الربع الأول", [
    { code: "6020", debit: 12000 },
    { code: "1010", credit: 12000 },
  ], { reference: "RENT-Q1" }),
  entry("e6", "DEP-001", "2025-03-31", "إهلاك ربع سنوي", [
    { code: "6050", debit: 10000 },
    { code: "1220", credit: 10000 },
  ]),
  entry("e7", "PUR-001", "2025-06-30", "شراء مخزون آجل", [
    { code: "1040", debit: 40000 },
    { code: "2010", credit: 40000 },
  ], { reference: "PUR-2025-010", source: "purchase" }),
  entry("e8", "PMT-001", "2025-09-30", "سداد مورد", [
    { code: "2010", debit: 50000 },
    { code: "1010", credit: 50000 },
  ]),
  entry("e9", "FIN-001", "2025-11-30", "فوائد تمويل", [
    { code: "7010", debit: 5000 },
    { code: "1010", credit: 5000 },
  ]),
  entry("e10", "TAX-001", "2025-12-31", "ضريبة مستحقة", [
    { code: "8010", debit: 4000 },
    { code: "2020", credit: 4000 },
  ]),
];

export const testLedger: Ledger = {
  accounts: testAccounts,
  entries: testEntries,
  currency: "SAR",
  periods: [
    { id: "p1", name: "2025", startDate: "2025-01-01", endDate: "2025-12-31", status: "open" },
  ],
};

export const unbalancedEntry: JournalEntry = entry("bad1", "BAD-001", "2025-05-05", "قيد غير متوازن", [
  { code: "1010", debit: 1000 },
  { code: "4010", credit: 900 },
]);

export const unknownAccountEntry: JournalEntry = entry("bad2", "BAD-002", "2025-05-06", "حساب غير معروف", [
  { code: "9999", debit: 500 },
  { code: "4010", credit: 500 },
]);

export const duplicatePair: JournalEntry[] = [
  entry("d1", "DUP-001", "2025-07-10", "فاتورة شراء مورد النخيل", [
    { code: "1040", debit: 25000 },
    { code: "2010", credit: 25000 },
  ], { reference: "PUR-777", source: "purchase" }),
  entry("d2", "DUP-002", "2025-07-10", "فاتورة شراء مورد النخيل", [
    { code: "1040", debit: 25000 },
    { code: "2010", credit: 25000 },
  ], { reference: "PUR-777", source: "purchase" }),
];
