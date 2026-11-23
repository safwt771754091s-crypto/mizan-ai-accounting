import type { Metadata } from "next";
import { History } from "lucide-react";
import { loadCompanyContext } from "@/lib/data/context";
import { AccessDenied, NoCompanyState } from "@/components/app/blocks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "سجل التدقيق" };

const ACTION_LABELS: Record<string, string> = {
  "entry.submit": "إرسال قيد للاعتماد",
  "entry.approve": "اعتماد قيد",
  "entry.reject": "رفض قيد",
  "entry.post": "ترحيل قيد",
  "entry.post_direct": "ترحيل مباشر",
  "entry.void": "إلغاء قيد",
  "period.close": "إغلاق فترة مالية",
  "period.reopen": "إعادة فتح فترة مالية",
  "proposal.create": "تقديم مقترح",
  "proposal.status": "تغيير حالة مقترح",
  "proposal.dispatch": "إرسال مقترح إلى GitHub",
  invite_member: "إضافة عضو",
  update_member_role: "تغيير دور عضو",
  remove_member: "إزالة عضو",
  update_company: "تحديث بيانات الشركة",
  create_role: "إنشاء دور مخصص",
  delete_role: "حذف دور مخصص",
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
    calendar: "gregory",
    numberingSystem: "latn",
  }).format(date);
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="سجل التدقيق" />
        <NoCompanyState />
      </>
    );
  }

  if (!ctx.allows("audit.view")) {
    return (
      <>
        <PageHeader title="سجل التدقيق" />
        <AccessDenied description="سجل التدقيق متاح لمن يملك صلاحية audit.view فقط." />
      </>
    );
  }

  const rows = await ctx.repo.listAudit(ctx.company.id, 200);
  let names = new Map<string, string>();
  try {
    const users = await ctx.repo.listUsers();
    names = new Map(users.map((user) => [user.id, user.fullName || user.email]));
  } catch {
    names = new Map();
  }

  return (
    <>
      <PageHeader
        title="سجل التدقيق"
        description="سجل غير قابل للتعديل لكل إجراء حسّاس: من فعله، على أي كيان، ومتى."
        eyebrow={ctx.company.name}
      />

      <Card>
        <CardHeader>
          <CardTitle>آخر 200 إجراء</CardTitle>
          <CardDescription>يُسجّل النظام الاعتماد والترحيل وإغلاق الفترات وتغييرات الأعضاء والأدوار.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <History className="h-4 w-4" />
              لا توجد إجراءات مسجّلة بعد لهذه الشركة.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-right text-sm">
                <thead className="border-b border-line text-xs text-muted">
                  <tr>
                    <th className="py-2 font-semibold">الوقت</th>
                    <th className="py-2 font-semibold">الإجراء</th>
                    <th className="py-2 font-semibold">المنفّذ</th>
                    <th className="py-2 font-semibold">الكيان</th>
                    <th className="py-2 font-semibold">تغيّر الحالة</th>
                    <th className="py-2 font-semibold">ملاحظة</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-line/60">
                      <td className="py-2 font-mono text-[11px] text-muted">{formatTime(row.createdAt)}</td>
                      <td className="py-2">
                        <Badge variant="outline">{ACTION_LABELS[row.action] ?? row.action}</Badge>
                      </td>
                      <td className="py-2 text-xs">{names.get(row.userId) ?? row.userId.slice(0, 8)}</td>
                      <td className="py-2 text-xs text-muted">
                        {row.entity}
                        {row.meta && typeof row.meta.entryNumber === "string" ? ` · ${row.meta.entryNumber}` : ""}
                        {row.meta && typeof row.meta.name === "string" ? ` · ${row.meta.name}` : ""}
                      </td>
                      <td className="py-2 text-xs text-muted">
                        {row.fromStatus || row.toStatus ? `${row.fromStatus ?? "—"} → ${row.toStatus ?? "—"}` : "—"}
                      </td>
                      <td className="py-2 text-xs">{row.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
