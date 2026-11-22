"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Receipt,
  Table2,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { DATASET_LIST, schemaFor } from "@/lib/import/datasets";
import { validateRows } from "@/lib/import/validate";
import type { ColumnMapping, ImportDataset, ImportIssue } from "@/lib/import/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/misc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Money } from "@/components/app/money";

const subscribe = () => () => {};

const ICONS: Record<ImportDataset, typeof Table2> = {
  trial_balance: Table2,
  general_ledger: BookOpen,
  journal_entries: FileText,
  sales: TrendingUp,
  purchases: Wallet,
  expenses: Receipt,
  customers: Users,
  suppliers: Building2,
  inventory: FileSpreadsheet,
  bank_statement: Wallet,
};

interface SheetResult {
  index: number;
  name: string;
  headers: string[];
  preview: string[][];
  totalRows: number;
  truncated: boolean;
  suggestion: {
    mapping: ColumnMapping;
    confidence: number;
    matched: string[];
    unmatched: string[];
    requiredMissing: string[];
    headerRowIndex: number;
  };
}

interface ParseResponse {
  ok: boolean;
  error?: string;
  warnings?: string[];
  fileName: string;
  kind: "xlsx" | "xls" | "csv" | "pdf";
  sizeBytes: number;
  checksum: string;
  parser: string;
  sheets: SheetResult[];
  schema: { dataset: ImportDataset; label: string; description: string };
}

interface ConfirmResponse {
  ok: boolean;
  error?: string;
  duplicate?: boolean;
  batchId?: string;
  skipped?: number;
  summary?: {
    rowCount: number;
    entryCount: number;
    accountCount: number;
    totalDebit: number;
    totalCredit: number;
    balanced: boolean;
    difference: number;
  };
  warnings?: string[];
  importedCount?: number;
  message?: string;
  issues?: ImportIssue[];
}

export function ImportWizard({ companyId, currency }: { companyId: string; currency: string }) {
  const [dataset, setDataset] = useState<ImportDataset>("journal_entries");
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmResponse | null>(null);
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const inputRef = useRef<HTMLInputElement>(null);

  const schema = schemaFor(dataset);
  const sheet = result?.sheets.find((s) => s.index === sheetIndex) ?? null;

  const validation = useMemo(() => {
    if (!sheet) return null;
    return validateRows({ rows: sheet.preview, schema, mapping });
  }, [sheet, schema, mapping]);

  const requiredMissing = schema.fields.filter((field) => field.required && mapping[field.key] == null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setConfirmed(null);
    setMapping({});
    setSheetIndex(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (selected: File) => {
    setError(null);
    setConfirmed(null);
    setResult(null);
    setFile(selected);

    const extension = selected.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv", "pdf"].includes(extension ?? "")) {
      setError("امتداد الملف غير مدعوم. المسموح: XLSX, XLS, CSV, PDF.");
      return;
    }
    if (selected.size > 15 * 1024 * 1024) {
      setError("حجم الملف يتجاوز 15 ميجابايت.");
      return;
    }

    setParsing(true);
    try {
      const body = new FormData();
      body.append("file", selected);
      body.append("dataset", dataset);
      body.append("companyId", companyId);
      const response = await fetch("/api/import/parse", { method: "POST", body });
      const payload = (await response.json()) as ParseResponse;
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "تعذر تحليل الملف.");
        setResult(null);
        return;
      }
      setResult(payload);
      const first = payload.sheets[0];
      setSheetIndex(first.index);
      setMapping(first.suggestion.mapping);
    } catch {
      setError("تعذر الاتصال بالخادم لتحليل الملف.");
    } finally {
      setParsing(false);
    }
  };

  const selectSheet = (index: number) => {
    if (!result) return;
    const next = result.sheets.find((s) => s.index === index);
    if (!next) return;
    setSheetIndex(index);
    setMapping(next.suggestion.mapping);
    setConfirmed(null);
  };

  const confirm = async () => {
    if (!file || !result || !sheet) return;
    if (requiredMissing.length) {
      setError("أكمل ربط الحقول المطلوبة قبل الاستيراد.");
      return;
    }
    if (validation && validation.errorCount > 0) {
      setError("توجد أخطاء في الصفوف المعروضة. صحّح الملف أو ربط الأعمدة قبل الاستيراد.");
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("companyId", companyId);
      body.append("dataset", dataset);
      body.append("fileKind", result.kind);
      body.append("checksum", result.checksum);
      body.append("sheetName", sheet.name);
      body.append("sheetIndex", String(sheet.index));
      body.append("mapping", JSON.stringify(mapping));
      const response = await fetch("/api/import/confirm", { method: "POST", body });
      const payload = (await response.json()) as ConfirmResponse;
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "تعذر الاستيراد.");
        if (payload.issues?.length) {
          setConfirmed(payload);
        }
        return;
      }
      setConfirmed(payload);
      setResult(null);
    } catch {
      setError("تعذر الاتصال بالخادم لإتمام الاستيراد.");
    } finally {
      setConfirming(false);
    }
  };

  const step = confirmed?.ok ? 4 : result ? 3 : file ? 2 : 1;

  return (
    <div className="space-y-4">
      <ol className="grid gap-2 sm:grid-cols-4">
        {[
          { n: 1, label: "نوع البيانات والملف" },
          { n: 2, label: "تحليل الملف" },
          { n: 3, label: "ربط الأعمدة والمراجعة" },
          { n: 4, label: "النتيجة" },
        ].map((item) => (
          <li
            key={item.n}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold ${
              step >= item.n ? "border-teal-200 bg-teal-50 text-teal-900" : "border-line bg-white text-muted"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                step >= item.n ? "bg-teal-600 text-white" : "bg-surface-2 text-muted"
              }`}
            >
              {step > item.n ? "✓" : item.n}
            </span>
            {item.label}
          </li>
        ))}
      </ol>

      {error ? <Alert variant="danger" title="تعذر إكمال العملية">{error}</Alert> : null}

      {confirmed?.ok ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success-50 text-success-600">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">{confirmed.message}</h2>
                <p className="mt-1 text-xs text-muted">
                  {confirmed.duplicate
                    ? "لم تُضف بيانات مكررة. يمكنك مراجعة سجل الاستيراد."
                    : `تم استيراد ${confirmed.importedCount ?? 0} سجلاً. كل سجل مرتبط بالملف ومصدره.`}
                </p>
              </div>
            </div>

            {confirmed.summary ? (
              <div className="grid gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-surface p-3">
                  <p className="text-[10px] text-muted">الصفوف</p>
                  <p className="text-sm font-bold" dir="ltr">{confirmed.summary.rowCount}</p>
                </div>
                <div className="rounded-xl bg-surface p-3">
                  <p className="text-[10px] text-muted">القيود</p>
                  <p className="text-sm font-bold" dir="ltr">{confirmed.summary.entryCount}</p>
                </div>
                <div className="rounded-xl bg-surface p-3">
                  <p className="text-[10px] text-muted">إجمالي المدين</p>
                  <p className="text-sm font-bold"><Money value={confirmed.summary.totalDebit} currency={currency} /></p>
                </div>
                <div className="rounded-xl bg-surface p-3">
                  <p className="text-[10px] text-muted">إجمالي الدائن</p>
                  <p className="text-sm font-bold"><Money value={confirmed.summary.totalCredit} currency={currency} /></p>
                </div>
              </div>
            ) : null}

            {confirmed.warnings?.length ? (
              <div className="space-y-1.5">
                {confirmed.warnings.slice(0, 6).map((warning) => (
                  <Alert key={warning} variant="warning">{warning}</Alert>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/imports?company=${companyId}`}>
                  عرض سجل الاستيراد
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/trial-balance?company=${companyId}`}>ميزان المراجعة</Link>
              </Button>
              <Button variant="ghost" onClick={reset}>رفع ملف آخر</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!confirmed?.ok ? (
        <>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>1. نوع البيانات والملف</CardTitle>
                <CardDescription>اختر نوع الملف المحاسبي ثم ارفع الملف. الحد الأقصى 15 ميجابايت.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {DATASET_LIST.map((item) => {
                  const Icon = ICONS[item.dataset];
                  const active = dataset === item.dataset;
                  return (
                    <button
                      key={item.dataset}
                      type="button"
                      onClick={() => {
                        setDataset(item.dataset);
                        reset();
                      }}
                      className={`rounded-xl border p-3 text-start transition-colors ${
                        active ? "border-teal-300 bg-teal-50" : "border-line bg-white hover:border-teal-200"
                      }`}
                    >
                      <Icon className={`mb-1.5 h-4 w-4 ${active ? "text-teal-700" : "text-muted"}`} />
                      <p className="text-[11px] font-bold text-ink">{item.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-muted">{item.description}</p>
                    </button>
                  );
                })}
              </div>

              <div
                className="rounded-2xl border border-dashed border-line bg-surface/50 p-6 text-center"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const dropped = event.dataTransfer.files?.[0];
                  if (dropped) void handleFile(dropped);
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  className="sr-only"
                  disabled={!hydrated}
                  onChange={(event) => {
                    const selected = event.target.files?.[0];
                    if (selected) void handleFile(selected);
                  }}
                />
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-teal-700">
                  {parsing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                </div>
                <p className="text-xs font-bold text-ink">
                  {parsing ? "جارٍ تحليل الملف..." : file ? file.name : "اسحب الملف هنا أو اختره من جهازك"}
                </p>
                <p className="mt-1 text-[10px] text-muted">XLSX · XLS · CSV · PDF — لا تُرفع الملفات إلى خدمات خارجية</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={!hydrated}
                  onClick={() => inputRef.current?.click()}
                >
                  اختيار ملف
                </Button>
                {file ? (
                  <button type="button" onClick={reset} className="ms-2 inline-flex items-center gap-1 text-[10px] text-muted hover:text-danger-600">
                    <X className="h-3 w-3" /> إزالة
                  </button>
                ) : null}
              </div>

              {result?.warnings?.length ? (
                <div className="space-y-1.5">
                  {result.warnings.map((warning) => (
                    <Alert key={warning} variant="warning">{warning}</Alert>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {result && sheet ? (
            <>
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>2. ورقة العمل والأعمدة</CardTitle>
                    <CardDescription>
                      {result.fileName} · {result.parser} · {sheet.totalRows} صف
                      {sheet.truncated ? " (تم اقتصاص الصفوف إلى 5000)" : ""}
                    </CardDescription>
                  </div>
                  <Badge variant={sheet.suggestion.confidence >= 60 ? "success" : "warning"}>
                    ثقة الاكتشاف {sheet.suggestion.confidence}%
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.sheets.length > 1 ? (
                    <div className="flex flex-wrap gap-2">
                      {result.sheets.map((item) => (
                        <button
                          key={item.index}
                          type="button"
                          onClick={() => selectSheet(item.index)}
                          className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${
                            item.index === sheetIndex ? "border-teal-300 bg-teal-50 text-teal-900" : "border-line bg-white text-muted"
                          }`}
                        >
                          {item.name} ({item.totalRows})
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {schema.fields.map((field) => (
                      <div key={field.key} className="rounded-xl border border-line p-2.5">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-bold text-ink">
                            {field.label}
                            {field.required ? <span className="text-danger-500"> *</span> : null}
                          </p>
                          <Badge variant={field.type === "money" ? "teal" : field.type === "date" ? "info" : "neutral"}>
                            {field.type === "money" ? "مبلغ" : field.type === "date" ? "تاريخ" : field.type === "number" ? "رقم" : "نص"}
                          </Badge>
                        </div>
                        <Select
                          value={mapping[field.key] ?? ""}
                          onChange={(event) =>
                            setMapping((current) => ({
                              ...current,
                              [field.key]: event.target.value === "" ? null : Number(event.target.value),
                            }))
                          }
                          className="h-9 text-xs"
                        >
                          <option value="">— غير مربوط —</option>
                          {sheet.headers.map((header, index) => (
                            <option key={`${header}-${index}`} value={index}>
                              {header}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setMapping(sheet.suggestion.mapping)}
                    >
                      إعادة الاكتشاف التلقائي
                    </Button>
                    {requiredMissing.length ? (
                      <span className="text-[11px] font-semibold text-danger-600">
                        حقول مطلوبة غير مربوطة: {requiredMissing.map((f) => f.label).join("، ")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> جميع الحقول المطلوبة مربوطة
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>3. المعاينة والمراجعة</CardTitle>
                    <CardDescription>معاينة أول {sheet.preview.length} صفاً. التحقق النهائي يتم على الخادم قبل الحفظ.</CardDescription>
                  </div>
                  {validation ? (
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={validation.errorCount ? "danger" : "success"}>
                        {validation.errorCount} خطأ
                      </Badge>
                      <Badge variant={validation.warningCount ? "warning" : "neutral"}>
                        {validation.warningCount} تحذير
                      </Badge>
                      {validation.duplicateRowCount ? (
                        <Badge variant="warning">{validation.duplicateRowCount} صف مكرر</Badge>
                      ) : null}
                    </div>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  {validation ? (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl bg-surface p-3">
                        <p className="text-[10px] text-muted">إجمالي المدين (المعاينة)</p>
                        <p className="text-sm font-bold"><Money value={validation.totalDebit} currency={currency} /></p>
                      </div>
                      <div className="rounded-xl bg-surface p-3">
                        <p className="text-[10px] text-muted">إجمالي الدائن (المعاينة)</p>
                        <p className="text-sm font-bold"><Money value={validation.totalCredit} currency={currency} /></p>
                      </div>
                      <div className={`rounded-xl p-3 ${validation.balanced ? "bg-success-50" : "bg-warning-50"}`}>
                        <p className="text-[10px] text-muted">توازن المعاينة</p>
                        <p className={`text-sm font-bold ${validation.balanced ? "text-success-600" : "text-warning-600"}`}>
                          {validation.balanced ? "متوازن" : `فرق ${validation.difference.toFixed(2)}`}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <TableWrap>
                    <Table>
                      <THead>
                        <TR>
                          <TH>#</TH>
                          {schema.fields
                            .filter((field) => mapping[field.key] != null)
                            .map((field) => (
                              <TH key={field.key}>{field.label}</TH>
                            ))}
                        </TR>
                      </THead>
                      <TBody>
                        {sheet.preview.slice(0, 10).map((row, rowIndex) => (
                          <TR key={rowIndex}>
                            <TD className="text-[10px] text-muted" dir="ltr">{rowIndex + 2}</TD>
                            {schema.fields
                              .filter((field) => mapping[field.key] != null)
                              .map((field) => (
                                <TD key={field.key} className="max-w-[220px] truncate text-[11px]">
                                  {row[mapping[field.key] as number] ?? ""}
                                </TD>
                              ))}
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </TableWrap>

                  {validation?.issues.length ? (
                    <div className="max-h-52 space-y-1.5 overflow-y-auto">
                      {validation.issues.slice(0, 12).map((issue, index) => (
                        <div
                          key={`${issue.code}-${issue.row}-${index}`}
                          className={`rounded-lg border p-2 text-[11px] ${
                            issue.level === "error"
                              ? "border-danger-100 bg-danger-50 text-danger-600"
                              : "border-warning-100 bg-warning-50 text-warning-600"
                          }`}
                        >
                          {issue.row > 0 ? <span className="me-1 font-bold">صف {issue.row}:</span> : null}
                          {issue.message}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <div className="text-[10px] text-muted">
                      بصمة الملف: <code dir="ltr" className="rounded bg-surface px-1.5 py-0.5 font-mono">{result.checksum.slice(0, 16)}…</code>
                      <span className="mx-1">·</span>
                      {Math.round(result.sizeBytes / 1024)} كيلوبايت
                    </div>
                    <Button type="button" onClick={confirm} disabled={confirming || requiredMissing.length > 0}>
                      {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {confirming ? "جارٍ التحقق والحفظ..." : "تأكيد الاستيراد"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}

          {confirmed && !confirmed.ok && confirmed.issues?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-danger-600">
                  <AlertTriangle className="h-4 w-4" />
                  أخطاء تمنع الاستيراد
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {confirmed.issues.map((issue, index) => (
                  <div key={index} className="rounded-lg border border-danger-100 bg-danger-50 p-2 text-[11px] text-danger-600">
                    {issue.row > 0 ? <span className="me-1 font-bold">صف {issue.row}:</span> : null}
                    {issue.message}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
