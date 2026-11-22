import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2, FileSpreadsheet, Receipt, ShieldAlert, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getRepository } from "@/lib/data/repository";
import { MEMBER_ROLE_LABELS } from "@/lib/data/types";
import { buildIncomeStatement, buildBalanceSheet } from "@/lib/accounting/statements";
import { detectAuditFindings } from "@/lib/accounting/findings";
import { Money } from "@/components/app/money";
import { CompanyForm } from "@/components/app/company-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "تفاصيل الشركة" };

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/companies/${id}`);
  const repo = getRepository();
  const access = await repo.getCompanyAccess(user.id, id);
  if (!access) notFound();

  const { company, role } = access;
  const data = await repo.getCompanyData(company.id);
  const ledger = {
    accounts: data.accounts,
    entries: data.entries,
    periods: data.periods,
    currency: company.currency,
  };
  const period = { from: company.fiscalYearStart, to: company.fiscalYearEnd };
  const income = buildIncomeStatement(ledger, period);
  const balance = buildBalanceSheet(ledger, { ...period, periodStart: period.from });
  const findings = detectAuditFindings(ledger, period);
  const members = await repo.listMembers(company.id);

  return (
    <>
      <PageHeader
        eyebrow={company.legalName}
        title={company.name}
        description={`${company.activityType} · ${company.city ?? ""} · ${company.currency} · السنة المالية ${company.fiscalYearStart.slice(0, 4)}`}
        actions={
          <>
            <Badge variant="teal">{MEMBER_ROLE_LABELS[role]}</Badge>
            <Button asChild variant="outline">
              <Link href={`/upload?company=${company.id}`}>
                <FileSpreadsheet className="h-4 w-4" />
                رفع ملف
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/statements?company=${company.id}`}>القوائم المالية</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">صافي الإيرادات</p>
          <p className="mt-1 text-lg font-bold text-brand-900">
            <Money value={income.netRevenue} currency={company.currency} />
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">صافي الربح</p>
          <p className="mt-1 text-lg font-bold text-brand-900">
            <Money value={income.netProfit} currency={company.currency} />
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">إجمالي الأصول</p>
          <p className="mt-1 text-lg font-bold text-brand-900">
            <Money value={balance.totalAssets} currency={company.currency} />
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">ملاحظات الفحص</p>
          <p className="mt-1 text-lg font-bold text-brand-900" dir="ltr">{findings.length}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-teal-700" />
                بيانات الشركة
              </CardTitle>
              <CardDescription>تعديل البيانات ينعكس على التقارير والفترات المالية الجديدة.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CompanyForm company={company} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-700" />
                المستخدمون المرتبطون
              </CardTitle>
              <CardDescription>{members.length} عضو في هذه الشركة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">{member.user.fullName}</p>
                    <p className="truncate text-[10px] text-muted" dir="ltr">{member.user.email}</p>
                  </div>
                  <Badge variant="neutral">{MEMBER_ROLE_LABELS[member.role]}</Badge>
                </div>
              ))}
              <Link href={`/users?company=${company.id}`} className="inline-block pt-1 text-[11px] font-bold text-teal-700 hover:underline">
                إدارة الصلاحيات
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-teal-700" />
                آخر عمليات الاستيراد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.batches.length ? (
                data.batches.slice(0, 4).map((batch) => (
                  <div key={batch.id} className="rounded-xl border border-line p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[11px] font-semibold text-ink">{batch.fileName}</p>
                      <Badge variant={batch.status === "completed" ? "success" : batch.status === "partial" ? "warning" : "danger"}>
                        {batch.status === "completed" ? "مكتمل" : batch.status === "partial" ? "جزئي" : "فاشل"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[10px] text-muted">
                      {batch.rowCount} صف · {formatDateShort(batch.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-[11px] text-muted">لا يوجد استيراد بعد.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-warning-500" />
            ملخص الفحص
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>الفئة</TH>
                  <TH>عدد الملاحظات</TH>
                  <TH>أعلى خطورة</TH>
                </TR>
              </THead>
              <TBody>
                {[
                  { label: "حرجة", items: findings.filter((f) => f.severity === "critical") },
                  { label: "مرتفعة", items: findings.filter((f) => f.severity === "high") },
                  { label: "متوسطة", items: findings.filter((f) => f.severity === "medium") },
                  { label: "منخفضة", items: findings.filter((f) => f.severity === "low") },
                ].map((row) => (
                  <TR key={row.label}>
                    <TD className="text-xs">{row.label}</TD>
                    <TD className="text-xs" dir="ltr">{row.items.length}</TD>
                    <TD className="text-xs text-muted">{row.items[0]?.title ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>
    </>
  );
}
