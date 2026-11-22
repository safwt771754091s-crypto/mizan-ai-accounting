import Link from "next/link";
import { ArrowUpRight, Building2, CheckCircle2, Plus, RotateCcw } from "lucide-react";
import type { AuditFinding, RatioResult, StatementLine } from "@/lib/accounting/types";
import type { FindingState } from "@/lib/data/types";
import { setFindingStatusAction } from "@/app/actions/company";
import { Money, PercentText } from "./money";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/misc";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateArabic } from "@/lib/utils/dates";

export function NoCompanyState() {
  return (
    <EmptyState
      icon={<Building2 className="h-6 w-6" />}
      title="لا توجد شركة مرتبطة بحسابك بعد"
      description="أنشئ شركة أولاً لتتمكن من رفع الملفات وإعداد القوائم المالية والتحليل."
      action={
        <Button asChild>
          <Link href="/companies/new">
            <Plus className="h-4 w-4" />
            إنشاء شركة
          </Link>
        </Button>
      }
    />
  );
}

export function PeriodPicker({
  companyId,
  from,
  to,
  extra,
}: {
  companyId?: string;
  from: string;
  to: string;
  extra?: Record<string, string>;
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-white p-3 no-print">
      {companyId ? <input type="hidden" name="company" value={companyId} /> : null}
      {Object.entries(extra ?? {}).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <label className="text-[11px] font-semibold text-muted">
        من
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="mt-1 block h-9 rounded-lg border border-line bg-white px-2 text-xs text-ink"
        />
      </label>
      <label className="text-[11px] font-semibold text-muted">
        إلى
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="mt-1 block h-9 rounded-lg border border-line bg-white px-2 text-xs text-ink"
        />
      </label>
      <Button type="submit" variant="secondary" size="sm">
        تحديث الفترة
      </Button>
    </form>
  );
}

export function StatementTable({
  lines,
  currency,
  dense = false,
  showNotes = true,
}: {
  lines: StatementLine[];
  currency: string;
  dense?: boolean;
  showNotes?: boolean;
}) {
  return (
    <TableWrap className="border-0 shadow-none">
      <Table>
        <THead>
          <TR>
            <TH className="w-full">البيان</TH>
            <TH className="text-left">المبلغ</TH>
          </TR>
        </THead>
        <TBody>
          {lines.map((line) => {
            if (line.isHeader) {
              return (
                <TR key={line.key} className="bg-surface/70 hover:bg-surface/70">
                  <TD colSpan={2} className="text-xs font-bold text-brand-900">
                    {line.label}
                  </TD>
                </TR>
              );
            }
            return (
              <TR key={line.key} className={line.isTotal ? "bg-brand-50/40" : undefined}>
                <TD
                  className={[
                    dense ? "py-2 text-xs" : "text-sm",
                    line.isTotal ? "font-bold text-brand-950" : "text-ink",
                  ].join(" ")}
                  style={{ paddingInlineStart: `${1 + line.level * 1.1}rem` }}
                >
                  {line.label}
                  {showNotes && line.note ? <span className="ms-2 text-[10px] text-muted">({line.note})</span> : null}
                </TD>
                <TD className={`text-left ${line.isTotal ? "font-bold" : ""}`}>
                  <Money value={line.amount} currency={currency} colored={!line.isHeader} />
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableWrap>
  );
}

export function RatioGrid({ ratios }: { ratios: RatioResult[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {ratios.map((ratio) => (
        <div key={ratio.key} className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold text-ink">{ratio.label}</p>
            {ratio.available ? <Badge variant="teal">متاحة</Badge> : <Badge variant="neutral">غير متاحة</Badge>}
          </div>
          <div className="mt-2">
            {ratio.available && ratio.value !== null ? (
              <p className="text-xl font-bold text-brand-900">
                <span dir="ltr" className="num">
                  {ratio.unit === "percent"
                    ? `${ratio.value.toFixed(1)}%`
                    : ratio.unit === "days"
                      ? `${ratio.value.toFixed(0)} يوم`
                      : ratio.unit === "times"
                        ? `${ratio.value.toFixed(2)} مرة`
                        : ratio.value.toFixed(2)}
                </span>
              </p>
            ) : (
              <p className="text-xs leading-6 text-muted">{ratio.unavailableReason}</p>
            )}
          </div>
          <p className="mt-2 rounded-lg bg-surface px-2 py-1.5 text-[10px] leading-5 text-muted">{ratio.formula}</p>
          <p className="mt-2 text-[11px] leading-6 text-ink/75">{ratio.interpretation}</p>
          {ratio.benchmark ? <p className="mt-1 text-[10px] text-teal-700">{ratio.benchmark}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function FindingsTable({
  findings,
  companyId,
  currency,
  states,
  canReview,
  compact = false,
}: {
  findings: AuditFinding[];
  companyId: string;
  currency: string;
  states: FindingState[];
  canReview: boolean;
  compact?: boolean;
}) {
  if (!findings.length) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-6 w-6" />}
        title="لا توجد ملاحظات في هذه الفئة"
        description="لم يكتشف المحرك أي ملاحظات مطابقة للفلاتر الحالية. هذا لا يعني ضمان سلامة البيانات بالكامل."
      />
    );
  }

  return (
    <div className="space-y-3">
      {findings.map((finding) => {
        const state = states.find((s) => s.findingId === finding.id);
        const status = state?.status ?? finding.status;
        return (
          <div key={finding.id} className="rounded-2xl border border-line bg-white p-4 print-break">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <SeverityBadge severity={finding.severity} />
                <h3 className="text-sm font-bold text-ink">{finding.title}</h3>
                {status !== "open" ? (
                  <Badge variant={status === "reviewed" ? "success" : "neutral"}>
                    {status === "reviewed" ? "تمت المراجعة" : "مستبعد"}
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted">
                {finding.amount !== null ? <Money value={finding.amount} currency={currency} /> : null}
                {finding.accountCode ? <span>حساب {finding.accountCode}</span> : null}
                {finding.entryNumber ? <span>قيد {finding.entryNumber}</span> : null}
              </div>
            </div>

            <p className="mt-2 text-xs leading-6 text-ink/80">{finding.description}</p>

            {!compact ? (
              <div className="mt-3 grid gap-2 text-[11px] leading-6 sm:grid-cols-2">
                <div className="rounded-lg bg-surface p-2.5">
                  <p className="font-bold text-ink">سبب الاكتشاف</p>
                  <p className="text-muted">{finding.reason}</p>
                </div>
                <div className="rounded-lg bg-teal-50 p-2.5">
                  <p className="font-bold text-teal-900">التوصية</p>
                  <p className="text-teal-900/80">{finding.recommendation}</p>
                </div>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted">
                <span>الثقة {Math.round(finding.confidence * 100)}%</span>
                <span>·</span>
                <span>{formatDateArabic(finding.detectedAt.slice(0, 10))}</span>
                {finding.source ? (
                  <>
                    <span>·</span>
                    <span>المصدر: {finding.source}</span>
                  </>
                ) : null}
              </div>
              {canReview ? (
                <div className="flex items-center gap-1.5 no-print">
                  <form action={setFindingStatusAction}>
                    <input type="hidden" name="companyId" value={companyId} />
                    <input type="hidden" name="findingId" value={finding.id} />
                    <input type="hidden" name="status" value="reviewed" />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg border border-success-100 bg-success-50 px-2 py-1 text-[10px] font-bold text-success-600 hover:bg-success-100"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      تمت المراجعة
                    </button>
                  </form>
                  <form action={setFindingStatusAction}>
                    <input type="hidden" name="companyId" value={companyId} />
                    <input type="hidden" name="findingId" value={finding.id} />
                    <input type="hidden" name="status" value="dismissed" />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-[10px] font-bold text-muted hover:bg-surface"
                    >
                      استبعاد
                    </button>
                  </form>
                  {status !== "open" ? (
                    <form action={setFindingStatusAction}>
                      <input type="hidden" name="companyId" value={companyId} />
                      <input type="hidden" name="findingId" value={finding.id} />
                      <input type="hidden" name="status" value="open" />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-[10px] font-bold text-muted hover:bg-surface"
                      >
                        <RotateCcw className="h-3 w-3" />
                        إعادة فتح
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function InsightCard({
  title,
  description,
  href,
  label,
  value,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-line bg-white p-4 transition-colors hover:border-teal-200 hover:bg-teal-50/40"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-ink">{title}</p>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted transition-colors group-hover:text-teal-700" />
      </div>
      <p className="mt-1 text-lg font-bold text-brand-900">{value}</p>
      <p className="mt-1 text-[10px] text-muted">{label}</p>
      <p className="mt-2 text-[11px] leading-5 text-muted">{description}</p>
    </Link>
  );
}

export function KpiRow({
  items,
  currency,
}: {
  items: Array<{ label: string; value: number; hint?: string; tone?: "success" | "danger" }>;
  currency: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] font-semibold text-muted">{item.label}</p>
          <p className={`mt-1 text-lg font-bold ${item.tone === "danger" ? "text-danger-600" : item.tone === "success" ? "text-success-600" : "text-brand-900"}`}>
            <Money value={item.value} currency={currency} />
          </p>
          {item.hint ? <p className="mt-0.5 text-[10px] text-muted">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function ChangeBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[10px] text-muted">لا توجد فترة مقارنة</span>;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
        value >= 0 ? "bg-success-50 text-success-600" : "bg-danger-50 text-danger-600"
      }`}
    >
      <span dir="ltr">{value >= 0 ? "+" : ""}{value.toFixed(1)}%</span>
    </span>
  );
}

export function FormulaNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-[10px] leading-5 text-muted">{children}</p>;
}

export function MetricCard({
  title,
  value,
  unit,
  formula,
}: {
  title: string;
  value: number | null;
  unit?: string;
  formula: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs">{title}</CardTitle>
        <CardDescription>{formula}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-brand-900">
          {value === null ? "—" : <><span dir="ltr" className="num">{value.toFixed(2)}</span> {unit}</>}
        </p>
      </CardContent>
    </Card>
  );
}

export function PercentCell({ value }: { value: number | null }) {
  return <PercentText value={value} />;
}

export function AccessDenied({
  title = "لا تملك صلاحية الوصول",
  description = "هذه الصفحة تتطلب صلاحية لا يمنحها دورك الحالي. تواصل مع مالك الشركة أو مديرها.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-xl py-16">
      <Alert variant="warning" title={title}>
        {description}
      </Alert>
      <p className="mt-3 text-center text-[11px] text-muted">
        التحقق يتم على الخادم أيضاً، ولا يكفي إخفاء العنصر في الواجهة.
      </p>
    </div>
  );
}
