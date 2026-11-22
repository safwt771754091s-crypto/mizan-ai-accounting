export type ImportDataset =
  | "trial_balance"
  | "general_ledger"
  | "journal_entries"
  | "sales"
  | "purchases"
  | "expenses"
  | "customers"
  | "suppliers"
  | "inventory"
  | "bank_statement";

export type FieldType = "text" | "money" | "date" | "number";

export interface ImportField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  aliases: string[];
  hint?: string;
}

export interface DatasetSchema {
  dataset: ImportDataset;
  label: string;
  description: string;
  fields: ImportField[];
  /** الحقول التي تُستخدم لاكتشاف تكرار الصفوف داخل الملف. */
  duplicateKeys: string[];
}

export interface ParsedSheet {
  name: string;
  index: number;
  headers: string[];
  rows: string[][];
  totalRows: number;
  truncated: boolean;
}

export type FileKind = "xlsx" | "xls" | "csv" | "pdf";

export interface ParsedWorkbook {
  fileName: string;
  kind: FileKind;
  sizeBytes: number;
  sheets: ParsedSheet[];
  warnings: string[];
  parser: "exceljs" | "papaparse" | "pdf-parse" | "text-fallback";
}

export interface ColumnMapping {
  [fieldKey: string]: number | null;
}

export interface MappingSuggestion {
  mapping: ColumnMapping;
  confidence: number;
  matched: string[];
  unmatched: string[];
  requiredMissing: string[];
  headerRowIndex: number;
}

export type ImportIssueLevel = "error" | "warning" | "info";

export interface ImportIssue {
  row: number;
  field?: string;
  code: string;
  message: string;
  level: ImportIssueLevel;
}

export interface NormalizedRow {
  rowNumber: number;
  values: Record<string, string>;
  amount?: number;
  date?: string;
}

export interface ValidationResult {
  rows: NormalizedRow[];
  issues: ImportIssue[];
  errorCount: number;
  warningCount: number;
  duplicateRowCount: number;
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  difference: number;
}

export interface ImportAccountDraft {
  code: string;
  name: string;
  debit: number;
  credit: number;
  subtype?: string;
  accountType?: string;
  inferenceNote?: string;
}

export interface ImportEntryDraft {
  entryNumber: string;
  date: string;
  description: string;
  reference?: string;
  lines: Array<{
    accountCode: string;
    accountName?: string;
    debit: number;
    credit: number;
    description?: string;
    costCenter?: string;
    branch?: string;
  }>;
}

export interface ImportPlan {
  dataset: ImportDataset;
  accounts: ImportAccountDraft[];
  entries: ImportEntryDraft[];
  records: NormalizedRow[];
  issues: ImportIssue[];
  summary: {
    rowCount: number;
    entryCount: number;
    accountCount: number;
    totalDebit: number;
    totalCredit: number;
    balanced: boolean;
    difference: number;
  };
  warnings: string[];
}

export interface ImportBatchRecord {
  id: string;
  companyId: string;
  fileName: string;
  fileKind: FileKind;
  sizeBytes: number;
  checksum: string;
  dataset: ImportDataset;
  sheetName: string;
  mapping: ColumnMapping;
  rowCount: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  warningCount: number;
  status: "completed" | "failed" | "partial";
  createdAt: string;
  createdBy: string;
  issues: ImportIssue[];
  warnings: string[];
}
