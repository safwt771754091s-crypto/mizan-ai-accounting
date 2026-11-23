import type { Metadata } from "next";
import { CalendarRange, Lock, LockOpen } from "lucide-react";
import { loadCompanyContext } from "@/lib/data/context";
import { AccessDenied, NoCompanyState } from "@/components/app/blocks";
import { JournalActionForm } from "@/components/app/journal-action-form";
import { closePeriodAction, reopenPeriodAction } from "@/app/actions/journal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader, StatCard } from "@/components/ui/misc";

export const metadata: Metadata = { title: "الفترات المالية" };

const STATUS_LABELS = { open: "مفتوحة", closed: "مغلقة", locked: "مقفلة" } as const;
const STATUS_VARIANTS = { open: "success", closed: "warning", locked: "neutral" } as const;

export default async function PeriodsPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="الفترات المالية" />
        <NoCompanyState />
      </>
    );
  }

  if (!ctx.allows("periods.read")) {
    return (
      <>
        <PageHeader title="الفترات المالية" />
        <AccessDenied description="عرض الفترات المالية يحتاج صلاحية periods.read." />
      </>
    );
  }

  const companyId = ctx.company.id;
  const periods = [...ctx.data.periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const unpostedIn = (start: string, end: string) =>
    ctx.data.entries.filter(
      (entry) =>
        entry.date.slice(0, 10) >= start.slice(0, 10) &&
        entry.date.slice(0, 10) <= end.slice(0, 10) &&
        entry.status !== "posted" &&
        entry.status !== "void",
    ).length;

  const canClose = ctx.allows("periods.close");
  const canReopen = ctx.allows("periods.reopen");
  const openCount = periods.filter((period) => period.status === "open").length;

  return (
    <>
      <PageHeader
        title="الفترات المالية"
        description="إغلاق الفترة يمنع أي ترحيل أو استيراد جديد فيها، ولا يتم إلا بعد ترحيل كل القيود المعلّقة."
        eyebrow={ctx.company.name}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="عدد الفترات" value={String(periods.length)} icon={<CalendarRange className="h-4 w-4" />} />
        <StatCard label="فترات مفتوحة" value={String(openCount)} icon={<LockOpen className="h-4 w-4" />} />
        <StatCard label="فترات مغلقة" value={String(periods.length - openCount)} icon={<Lock className="h-4 w-4" />} />
      </div>

      {!canClose && !canReopen ? (
        <Alert variant="info" title="صلاحية القراءة فقط">
          إغلاق الفترات وإعادة فتحها يحتاج صلاحية periods.close أو periods.reopen.
        </Alert>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>الفترات</CardTitle>
          <CardDescription>القيود غير المرحّلة تمنع إغلاق الفترة؛ اعتمدها أو ارفضها أولاً.</CardDescription>
        </CardHeader>
        <CardContent>
          {periods.length === 0 ? (
            <p className="text-sm text-muted">لا توجد فترات مالية معرّفة لهذه الشركة.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-right text-sm">
                <thead className="border-b border-line text-xs text-muted">
                  <tr>
                    <th className="py-2 font-semibold">الفترة</th>
                    <th className="py-2 font-semibold">من</th>
                    <th className="py-2 font-semibold">إلى</th>
                    <th className="py-2 font-semibold">الحالة</th>
                    <th className="py-2 font-semibold">قيود معلّقة</th>
                    <th className="py-2 font-semibold">الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => {
                    const pending = unpostedIn(period.startDate, period.endDate);
                    const fields = { companyId, periodId: period.id };
                    return (
                      <tr key={period.id} className="border-b border-line/60 align-top">
                        <td className="py-2">{period.name}</td>
                        <td className="py-2 font-mono text-xs">{period.startDate.slice(0, 10)}</td>
                        <td className="py-2 font-mono text-xs">{period.endDate.slice(0, 10)}</td>
                        <td className="py-2">
                          <Badge variant={STATUS_VARIANTS[period.status]}>{STATUS_LABELS[period.status]}</Badge>
                        </td>
                        <td className="py-2 font-mono text-xs">
                          {pending > 0 ? <span className="text-warning-600">{pending}</span> : "0"}
                        </td>
                        <td className="py-2">
                          {period.status === "open" && canClose ? (
                            <JournalActionForm
                              action={closePeriodAction}
                              fields={fields}
                              label="إغلاق الفترة"
                              variant="outline"
                            />
                          ) : null}
                          {period.status === "closed" && canReopen ? (
                            <JournalActionForm
                              action={reopenPeriodAction}
                              fields={fields}
                              label="إعادة الفتح"
                              variant="danger"
                              withNote
                              noteRequired
                              notePlaceholder="سبب إعادة الفتح"
                            />
                          ) : null}
                          {period.status === "locked" ? <span className="text-xs text-muted">مقفلة نهائياً</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
