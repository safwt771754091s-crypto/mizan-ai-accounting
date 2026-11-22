import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { buildTrialBalance, listMonths } from "@/lib/accounting/engine";
import { loadCompanyContext, resolvePeriod } from "@/lib/data/context";
import { Money } from "@/components/app/money";
import { NoCompanyState, PeriodPicker } from "@/components/app/blocks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { EmptyRow, Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { monthLabel } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "ميزان المراجعة" };

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; from?: string; to?: string; view?: string }>;
}) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="ميزان المراجعة" />
        <NoCompanyState />
      </>
    );
  }

  const companyId: string = ctx.company.id;
  const period = resolvePeriod(params, ctx.period);
  const view = params.view === "balances" ? "balances" : "totals";
  const trial = buildTrialBalance(ctx.ledger, period);
  const months = listMonths(ctx.company.fiscalYearStart.slice(0, 7), ctx.company.fiscalYearEnd.slice(0, 7));

  return (
    <>
      <PageHeader
        eyebrow={ctx.company.name}
        title="ميزان المراجعة"
        description={`الفترة ${period.from} إلى ${period.to} — ${trial.entryCount} قيداً مرحّلاً. ميزان المراجعة بالمجاميع والأرصدة.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/trial-balance?company=${companyId}&from=${period.from}&to=${period.to}&view=totals`}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold ${view === "totals" ? "border-teal-300 bg-teal-50 text-teal-900" : "border-line bg-white text-muted"}`}
            >
              بالمجاميع
            </Link>
            <Link
              href={`/trial-balance?company=${companyId}&from=${period.from}&to=${period.to}&view=balances`}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold ${view === "balances" ? "border-teal-300 bg-teal-50 text-teal-900" : "border-line bg-white text-muted"}`}
            >
              بالأرصدة
            </Link>
            <PeriodPicker companyId={companyId} from={period.from} to={period.to} extra={{ view }} />
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap gap-1.5 no-print">
        {months.map((month) => {
          const [year, m] = month.split("-").map(Number);
          const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
          const from = `${month}-01`;
          const to = `${month}-${String(lastDay).padStart(2, "0")}`;
          const active = period.from === from && period.to === to;
          return (
            <Link
              key={month}
              href={`/trial-balance?company=${companyId}&from=${from}&to=${to}&view=${view}`}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                active ? "border-teal-300 bg-teal-50 text-teal-900" : "border-line bg-white text-muted hover:border-teal-200"
              }`}
            >
              {monthLabel(month)}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">إجمالي المدين</p>
          <p className="mt-1 text-base font-bold text-brand-900"><Money value={trial.totals.closingDebit} currency={ctx.currency} /></p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">إجمالي الدائن</p>
          <p className="mt-1 text-base font-bold text-brand-900"><Money value={trial.totals.closingCredit} currency={ctx.currency} /></p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">الفرق</p>
          <p className={`mt-1 text-base font-bold ${trial.difference === 0 ? "text-success-600" : "text-danger-600"}`}>
            <Money value={trial.difference} currency={ctx.currency} />
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">الحالة</p>
          <div className="mt-1.5">
            <Badge variant={trial.balanced ? "success" : "danger"}>
              {trial.balanced ? (
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> متوازن</span>
              ) : (
                <span className="inline-flex items-center gap-1"><CircleAlert className="h-3 w-3" /> غير متوازن</span>
              )}
            </Badge>
          </div>
        </div>
      </div>

      {!trial.balanced ? (
        <div className="mt-3">
          <Alert variant="danger" title="ميزان المراجعة غير متوازن">
            الفرق {trial.difference.toFixed(2)} {ctx.currency}. راجع القيود غير المتوازنة من صفحة اكتشاف الأخطاء قبل
            الاعتماد على القوائم المالية.
          </Alert>
        </div>
      ) : null}

      {trial.unknownAccounts?.length ? (
        <div className="mt-3">
          <Alert variant="warning" title="حسابات غير معرّفة">
            {trial.unknownAccounts.join("، ")}
          </Alert>
        </div>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>تفاصيل الحسابات</CardTitle>
            <CardDescription>
              {view === "totals" ? "المجاميع المدينة والدائنة للفترة مع الأرصدة الافتتاحية والختامية." : "الأرصدة الافتتاحية والختامية لكل حساب."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>الحساب</TH>
                  <TH className="text-left">افتتاحي مدين</TH>
                  <TH className="text-left">افتتاحي دائن</TH>
                  {view === "totals" ? (
                    <>
                      <TH className="text-left">حركة مدين</TH>
                      <TH className="text-left">حركة دائن</TH>
                    </>
                  ) : null}
                  <TH className="text-left">ختامي مدين</TH>
                  <TH className="text-left">ختامي دائن</TH>
                </TR>
              </THead>
              <TBody>
                {trial.rows.length === 0 ? (
                  <EmptyRow colSpan={7} message="لا توجد حركات في الفترة المحددة." />
                ) : (
                  trial.rows.map((row) => (
                    <TR key={row.accountId}>
                      <TD className="max-w-[260px]">
                        <p className="truncate text-xs font-semibold text-ink">
                          <span className="me-1 text-[10px] text-muted" dir="ltr">{row.code}</span>
                          {row.name}
                        </p>
                      </TD>
                      <TD className="text-left text-[11px]"><Money value={row.openingDebit} currency={ctx.currency} showCurrency={false} /></TD>
                      <TD className="text-left text-[11px]"><Money value={row.openingCredit} currency={ctx.currency} showCurrency={false} /></TD>
                      {view === "totals" ? (
                        <>
                          <TD className="text-left text-[11px]"><Money value={row.debit} currency={ctx.currency} showCurrency={false} /></TD>
                          <TD className="text-left text-[11px]"><Money value={row.credit} currency={ctx.currency} showCurrency={false} /></TD>
                        </>
                      ) : null}
                      <TD className="text-left text-[11px] font-semibold"><Money value={row.closingDebit} currency={ctx.currency} showCurrency={false} /></TD>
                      <TD className="text-left text-[11px] font-semibold"><Money value={row.closingCredit} currency={ctx.currency} showCurrency={false} /></TD>
                    </TR>
                  ))
                )}
              </TBody>
              <tfoot>
                <TR className="bg-brand-50/60">
                  <TD className="text-xs font-bold">الإجمالي</TD>
                  <TD className="text-left text-[11px] font-bold"><Money value={trial.totals.openingDebit} currency={ctx.currency} showCurrency={false} /></TD>
                  <TD className="text-left text-[11px] font-bold"><Money value={trial.totals.openingCredit} currency={ctx.currency} showCurrency={false} /></TD>
                  {view === "totals" ? (
                    <>
                      <TD className="text-left text-[11px] font-bold"><Money value={trial.totals.debit} currency={ctx.currency} showCurrency={false} /></TD>
                      <TD className="text-left text-[11px] font-bold"><Money value={trial.totals.credit} currency={ctx.currency} showCurrency={false} /></TD>
                    </>
                  ) : null}
                  <TD className="text-left text-[11px] font-bold"><Money value={trial.totals.closingDebit} currency={ctx.currency} showCurrency={false} /></TD>
                  <TD className="text-left text-[11px] font-bold"><Money value={trial.totals.closingCredit} currency={ctx.currency} showCurrency={false} /></TD>
                </TR>
              </tfoot>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>

      <p className="mt-3 text-[10px] leading-5 text-muted">
        القيود المسودة والمستبعدة لا تدخل في ميزان المراجعة. الأرصدة الافتتاحية تشمل أرصدة دليل الحسابات والقيود السابقة
        لبداية الفترة.
      </p>
    </>
  );
}
