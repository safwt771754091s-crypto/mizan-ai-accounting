import type { Metadata } from "next";
import { CheckCircle2, FileClock, PenLine } from "lucide-react";
import { formatMoney } from "@/lib/accounting/money";
import { statusLabel } from "@/lib/accounting/workflow";
import { loadCompanyContext } from "@/lib/data/context";
import { AccessDenied, NoCompanyState } from "@/components/app/blocks";
import { JournalActionForm } from "@/components/app/journal-action-form";
import { approveEntryAction, postEntryAction, rejectEntryAction, submitEntryAction } from "@/app/actions/journal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader, StatCard } from "@/components/ui/misc";

export const metadata: Metadata = { title: "مسارات الاعتماد" };

const STATUS_VARIANT = {
  draft: "neutral",
  submitted: "warning",
  approved: "info",
  rejected: "danger",
  posted: "success",
  void: "neutral",
} as const;

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="مسارات الاعتماد" />
        <NoCompanyState />
      </>
    );
  }

  if (!ctx.allows("journal.read")) {
    return (
      <>
        <PageHeader title="مسارات الاعتماد" />
        <AccessDenied description="عرض مسارات الاعتماد يحتاج صلاحية قراءة القيود." />
      </>
    );
  }

  const companyId = ctx.company.id;
  const currency = ctx.company.currency;
  const amountOf = (entry: { lines: Array<{ debit: string | number }> }) =>
    entry.lines.reduce((total, line) => total + Number(line.debit || 0), 0);

  const submitted = ctx.data.entries.filter((entry) => entry.status === "submitted");
  const approved = ctx.data.entries.filter((entry) => entry.status === "approved");
  const myDrafts = ctx.data.entries.filter((entry) => entry.status === "draft" && entry.createdBy === ctx.user.id);
  const queue = [...submitted, ...approved, ...myDrafts].sort((a, b) => b.date.localeCompare(a.date));

  const canApprove = ctx.allows("journal.approve");
  const canPost = ctx.allows("journal.post");

  return (
    <>
      <PageHeader
        title="مسارات الاعتماد"
        description="القيود التي تنتظر اعتماداً أو ترحيلاً. لا يظهر أي قيد في القوائم المالية قبل ترحيله."
        eyebrow={ctx.company.name}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="بانتظار الاعتماد" value={String(submitted.length)} icon={<FileClock className="h-4 w-4" />} />
        <StatCard label="معتمد بانتظار الترحيل" value={String(approved.length)} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="مسوداتك" value={String(myDrafts.length)} icon={<PenLine className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة العمل</CardTitle>
          <CardDescription>
            {canApprove || canPost
              ? "الاعتماد لا ينفّذ الترحيل؛ الترحيل خطوة منفصلة تسجّل الأثر في الأرصدة."
              : "لا تملك صلاحية اعتماد أو ترحيل؛ يمكنك متابعة الحالة فقط."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {queue.length === 0 ? (
            <Alert variant="success" title="لا يوجد عمل معلّق">
              كل القيود مرحّلة، ولا توجد مسودات تنتظر إرسالاً.
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-right text-sm">
                <thead className="border-b border-line text-xs text-muted">
                  <tr>
                    <th className="py-2 font-semibold">رقم القيد</th>
                    <th className="py-2 font-semibold">التاريخ</th>
                    <th className="py-2 font-semibold">الوصف</th>
                    <th className="py-2 font-semibold">المبلغ</th>
                    <th className="py-2 font-semibold">الحالة</th>
                    <th className="py-2 font-semibold">الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((entry) => {
                    const selfCreated = Boolean(entry.createdBy && entry.createdBy === ctx.user.id);
                    const fields = { companyId, entryId: entry.id };
                    return (
                      <tr key={entry.id} className="border-b border-line/60 align-top">
                        <td className="py-2 font-mono text-xs">{entry.entryNumber}</td>
                        <td className="py-2 text-xs text-muted">{entry.date.slice(0, 10)}</td>
                        <td className="py-2">
                          <span className="block">{entry.description}</span>
                          {selfCreated && entry.status === "submitted" ? (
                            <span className="text-[11px] text-warning-600">أنشأته بنفسك — لا يمكنك اعتماده.</span>
                          ) : null}
                          {entry.reviewNote ? (
                            <span className="block text-[11px] text-danger-600">ملاحظة الرفض: {entry.reviewNote}</span>
                          ) : null}
                        </td>
                        <td className="py-2 font-mono text-xs">{formatMoney(amountOf(entry), currency)}</td>
                        <td className="py-2">
                          <Badge variant={STATUS_VARIANT[entry.status]}>{statusLabel(entry.status)}</Badge>
                        </td>
                        <td className="py-2">
                          {entry.status === "draft" && ctx.allows("journal.submit") ? (
                            <JournalActionForm
                              action={submitEntryAction}
                              fields={fields}
                              label="إرسال للاعتماد"
                              variant="outline"
                            />
                          ) : null}
                          {entry.status === "submitted" && canApprove && !selfCreated ? (
                            <div className="flex flex-wrap gap-2">
                              <JournalActionForm action={approveEntryAction} fields={fields} label="اعتماد" variant="teal" />
                              <JournalActionForm
                                action={rejectEntryAction}
                                fields={fields}
                                label="رفض"
                                variant="danger"
                                withNote
                                noteRequired
                                notePlaceholder="سبب الرفض"
                              />
                            </div>
                          ) : null}
                          {entry.status === "approved" && canPost ? (
                            <JournalActionForm action={postEntryAction} fields={fields} label="ترحيل" />
                          ) : null}
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
