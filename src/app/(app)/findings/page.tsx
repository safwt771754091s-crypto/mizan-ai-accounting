import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { detectAuditFindings } from "@/lib/accounting/findings";
import type { Severity } from "@/lib/accounting/types";
import { loadCompanyContext, resolvePeriod } from "@/lib/data/context";
import { FindingsTable, NoCompanyState, PeriodPicker } from "@/components/app/blocks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "اكتشاف الأخطاء" };

const SEVERITIES: Array<{ value: Severity | "all"; label: string }> = [
  { value: "all", label: "الكل" },
  { value: "critical", label: "حرج" },
  { value: "high", label: "مرتفع" },
  { value: "medium", label: "متوسط" },
  { value: "low", label: "منخفض" },
  { value: "info", label: "معلومة" },
];

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; from?: string; to?: string; severity?: string; status?: string }>;
}) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="اكتشاف الأخطاء" />
        <NoCompanyState />
      </>
    );
  }

  const period = resolvePeriod(params, ctx.period);
  const all = detectAuditFindings(ctx.ledger, period);
  const severityFilter = (params.severity ?? "all") as Severity | "all";
  const statusFilter = params.status ?? "all";

  const states = ctx.data.findingStates;
  const statusOf = (id: string) => states.find((state) => state.findingId === id)?.status ?? "open";

  const findings = all.filter((finding) => {
    if (severityFilter !== "all" && finding.severity !== severityFilter) return false;
    if (statusFilter !== "all" && statusOf(finding.id) !== statusFilter) return false;
    return true;
  });

  const counts = {
    total: all.length,
    critical: all.filter((f) => f.severity === "critical").length,
    high: all.filter((f) => f.severity === "high").length,
    open: all.filter((f) => statusOf(f.id) === "open").length,
    reviewed: all.filter((f) => statusOf(f.id) === "reviewed").length,
  };

  const query = (overrides: Record<string, string>) => {
    const base = new URLSearchParams({
      company: ctx.company!.id,
      from: period.from,
      to: period.to,
      severity: severityFilter,
      status: statusFilter,
      ...overrides,
    });
    return `/findings?${base.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow={ctx.company.name}
        title="اكتشاف الأخطاء والملاحظات"
        description="فحص محاسبي آلي للقيود والأرصدة والتصنيف. النتائج مؤشرات للمراجعة، وليست حكماً نهائياً بالخطأ."
        actions={<PeriodPicker companyId={ctx.company.id} from={period.from} to={period.to} extra={{ severity: severityFilter, status: statusFilter }} />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">إجمالي الملاحظات</p>
          <p className="mt-1 text-xl font-bold text-brand-900" dir="ltr">{counts.total}</p>
        </div>
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-4">
          <p className="text-[11px] text-danger-600">حرجة</p>
          <p className="mt-1 text-xl font-bold text-danger-600" dir="ltr">{counts.critical}</p>
        </div>
        <div className="rounded-2xl border border-warning-100 bg-warning-50 p-4">
          <p className="text-[11px] text-warning-600">مرتفعة</p>
          <p className="mt-1 text-xl font-bold text-warning-600" dir="ltr">{counts.high}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">مفتوحة</p>
          <p className="mt-1 text-xl font-bold text-brand-900" dir="ltr">{counts.open}</p>
        </div>
        <div className="rounded-2xl border border-success-100 bg-success-50 p-4">
          <p className="text-[11px] text-success-600">تمت مراجعتها</p>
          <p className="mt-1 text-xl font-bold text-success-600" dir="ltr">{counts.reviewed}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-muted">الخطورة:</span>
        {SEVERITIES.map((severity) => (
          <Link
            key={severity.value}
            href={query({ severity: severity.value })}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
              severityFilter === severity.value
                ? "border-teal-300 bg-teal-50 text-teal-900"
                : "border-line bg-white text-muted hover:border-teal-200"
            }`}
          >
            {severity.label}
          </Link>
        ))}
        <span className="ms-3 text-[11px] font-semibold text-muted">الحالة:</span>
        {[
          { value: "all", label: "الكل" },
          { value: "open", label: "مفتوحة" },
          { value: "reviewed", label: "تمت المراجعة" },
          { value: "dismissed", label: "مستبعدة" },
        ].map((status) => (
          <Link
            key={status.value}
            href={query({ status: status.value })}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
              statusFilter === status.value
                ? "border-teal-300 bg-teal-50 text-teal-900"
                : "border-line bg-white text-muted hover:border-teal-200"
            }`}
          >
            {status.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-warning-500" />
              الملاحظات ({findings.length})
            </CardTitle>
            <CardDescription>مراجعة الملاحظة لا تعني تصحيح القيد؛ التصحيح يتم في نظام المحاسبة المصدر.</CardDescription>
          </div>
          <Badge variant="neutral">{period.from} — {period.to}</Badge>
        </CardHeader>
        <CardContent>
          <FindingsTable
            findings={findings}
            companyId={ctx.company.id}
            currency={ctx.currency}
            states={states}
            canReview={ctx.role !== "viewer"}
          />
        </CardContent>
      </Card>

      <div className="mt-4">
        <Alert variant="info" title="كيف تُقرأ النتائج؟">
          كل ملاحظة تعرض سبب الاكتشاف والتوصية ودرجة الثقة. بعض الملاحظات قد تكون طبيعية بسبب طبيعة النشاط أو طريقة
          الترحيل. لا تُعد الملاحظات دليلاً على احتيال أو خطأ جوهري دون مراجعة المستندات.
        </Alert>
      </div>
    </>
  );
}
