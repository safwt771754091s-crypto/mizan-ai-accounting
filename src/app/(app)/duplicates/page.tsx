import type { Metadata } from "next";
import { Copy, ShieldCheck } from "lucide-react";
import { detectDuplicates } from "@/lib/accounting/duplicates";
import { loadCompanyContext, resolvePeriod } from "@/lib/data/context";
import { Money } from "@/components/app/money";
import { NoCompanyState, PeriodPicker } from "@/components/app/blocks";
import { StrengthBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateArabic } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "القيود المكررة" };

const KIND_LABELS: Record<string, string> = {
  journal_entry: "قيد يومية",
  invoice: "فاتورة",
  voucher: "سند",
  purchase: "عملية شراء",
  sale: "عملية بيع",
  expense: "مصروف",
};

export default async function DuplicatesPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="القيود المكررة" />
        <NoCompanyState />
      </>
    );
  }

  const period = resolvePeriod(params, ctx.period);
  const groups = detectDuplicates(ctx.ledger, period);
  const strong = groups.filter((group) => group.strength === "strong").length;
  const medium = groups.filter((group) => group.strength === "medium").length;

  return (
    <>
      <PageHeader
        eyebrow={ctx.company.name}
        title="القيود والفواتير المكررة المحتملة"
        description="تحليل متعدد المعايير: المبلغ والتاريخ والمرجع وتشابه الوصف والحسابات. لا يتم حذف أو تعديل أي قيد تلقائياً."
        actions={<PeriodPicker companyId={ctx.company.id} from={period.from} to={period.to} />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">مجموعات الاشتباه</p>
          <p className="mt-1 text-xl font-bold text-brand-900" dir="ltr">{groups.length}</p>
        </div>
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-4">
          <p className="text-[11px] text-danger-600">اشتباه قوي</p>
          <p className="mt-1 text-xl font-bold text-danger-600" dir="ltr">{strong}</p>
        </div>
        <div className="rounded-2xl border border-warning-100 bg-warning-50 p-4">
          <p className="text-[11px] text-warning-600">اشتباه متوسط</p>
          <p className="mt-1 text-xl font-bold text-warning-600" dir="ltr">{medium}</p>
        </div>
      </div>

      <Alert variant="info" title="كيف نتعامل مع النتائج؟">
        المنصة تعرض الاشتباه فقط. القرار النهائي يتطلب مراجعة المستندات الأصلية. لا تحذف أي قيد إلا بعد التحقق، ووفق
        سياسة الشركة والمعايير المحاسبية.
      </Alert>

      <div className="mt-4 space-y-4">
        {groups.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title="لا توجد مجموعات اشتباه بالتكرار"
            description="لم تُكتشف قيود أو فواتير متشابهة تتجاوز حد الاشتباه في الفترة المحددة."
          />
        ) : (
          groups.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    <Copy className="h-4 w-4 text-warning-500" />
                    {KIND_LABELS[group.kind] ?? group.kind} — {group.entries.length} سجلات متشابهة
                  </CardTitle>
                  <CardDescription>درجة الاشتباه {group.score.toFixed(0)}/100</CardDescription>
                </div>
                <StrengthBadge strength={group.strength} />
              </CardHeader>
              <CardContent className="space-y-3">
                <TableWrap>
                  <Table>
                    <THead>
                      <TR>
                        <TH>رقم القيد</TH>
                        <TH>التاريخ</TH>
                        <TH>البيان</TH>
                        <TH>المرجع</TH>
                        <TH className="text-left">المبلغ</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {group.entries.map((entry) => (
                        <TR key={entry.entryId}>
                          <TD className="text-[11px] font-semibold" dir="ltr">{entry.entryNumber}</TD>
                          <TD className="whitespace-nowrap text-[11px] text-muted">{formatDateArabic(entry.date.slice(0, 10))}</TD>
                          <TD className="max-w-[280px] truncate text-[11px]">{entry.description}</TD>
                          <TD className="text-[10px] text-muted" dir="ltr">{entry.reference ?? "—"}</TD>
                          <TD className="text-left text-[11px] font-semibold"><Money value={entry.amount} currency={ctx.currency} /></TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-surface p-3">
                    <p className="mb-1 text-[11px] font-bold text-ink">أسباب الاشتباه</p>
                    <ul className="space-y-1">
                      {group.reasons.map((reason) => (
                        <li key={reason} className="text-[10px] leading-5 text-muted">• {reason}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl bg-teal-50 p-3">
                    <p className="mb-1 text-[11px] font-bold text-teal-900">التوصية</p>
                    <p className="text-[10px] leading-6 text-teal-900/80">{group.recommendation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
