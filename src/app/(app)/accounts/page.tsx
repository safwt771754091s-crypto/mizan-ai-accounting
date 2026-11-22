import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { buildTrialBalance } from "@/lib/accounting/engine";
import { ACCOUNT_TYPE_LABELS, SUBTYPE_META, normalBalanceOf } from "@/lib/accounting/accounts";
import { loadCompanyContext, resolvePeriod } from "@/lib/data/context";
import { Money } from "@/components/app/money";
import { NoCompanyState, PeriodPicker } from "@/components/app/blocks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Table, TableWrap, TBody, TD, TH, THead, TR, EmptyRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "دليل الحسابات" };

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; q?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="دليل الحسابات" />
        <NoCompanyState />
      </>
    );
  }

  const period = resolvePeriod(params, ctx.period);
  const trial = buildTrialBalance(ctx.ledger, period);
  const balances = new Map(trial.rows.map((row) => [row.code, row]));
  const query = (params.q ?? "").trim();
  const accounts = ctx.data.accounts.filter((account) => {
    if (!query) return true;
    return `${account.code} ${account.name} ${account.nameEn ?? ""}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <>
      <PageHeader
        eyebrow={ctx.company.name}
        title="دليل الحسابات"
        description="تصنيف الحسابات يحدد مكانها في القوائم المالية. الحسابات غير المصنفة تظهر كملاحظة في وحدة الفحص."
        actions={<PeriodPicker companyId={ctx.company.id} from={period.from} to={period.to} extra={query ? { q: query } : undefined} />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {(["asset", "liability", "equity", "revenue"] as const).map((type) => (
          <div key={type} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[11px] text-muted">{ACCOUNT_TYPE_LABELS[type]}</p>
            <p className="mt-1 text-lg font-bold text-brand-900" dir="ltr">
              {ctx.data.accounts.filter((account) => account.type === type).length}
            </p>
          </div>
        ))}
      </div>

      {trial.unknownAccounts?.length ? (
        <Alert variant="warning" title="حسابات مستخدمة في القيود وغير موجودة في الدليل">
          {trial.unknownAccounts.join("، ")} — أضفها إلى الدليل أو صحّح أرقام الحسابات في القيود.
        </Alert>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>الحسابات ({accounts.length})</CardTitle>
            <CardDescription>الرصيد الختامي محسوب حتى نهاية الفترة المحددة.</CardDescription>
          </div>
          <form method="get" className="flex items-end gap-2">
            {ctx.company ? <input type="hidden" name="company" value={ctx.company.id} /> : null}
            <input type="hidden" name="from" value={period.from} />
            <input type="hidden" name="to" value={period.to} />
            <Input name="q" defaultValue={query} placeholder="ابحث بالاسم أو الرقم..." className="h-9 w-44 text-xs" />
            <Button type="submit" variant="secondary" size="sm">بحث</Button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>الرقم</TH>
                  <TH>اسم الحساب</TH>
                  <TH>النوع</TH>
                  <TH>التصنيف</TH>
                  <TH>الطبيعة</TH>
                  <TH className="text-left">مدين</TH>
                  <TH className="text-left">دائن</TH>
                  <TH className="text-left">الرصيد</TH>
                </TR>
              </THead>
              <TBody>
                {accounts.length === 0 ? (
                  <EmptyRow colSpan={8} message="لا توجد حسابات مطابقة." />
                ) : (
                  accounts.map((account) => {
                    const row = balances.get(account.code);
                    const closing = row?.netBalance ?? 0;
                    return (
                      <TR key={account.id}>
                        <TD className="text-[11px] font-semibold text-muted" dir="ltr">{account.code}</TD>
                        <TD className="text-xs font-semibold">{account.name}</TD>
                        <TD>
                          <Badge variant="neutral">{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
                        </TD>
                        <TD className="text-[11px] text-muted">{SUBTYPE_META[account.subtype]?.label ?? account.subtype}</TD>
                        <TD className="text-[11px] text-muted">
                          {normalBalanceOf(account) === "debit" ? "مدين" : "دائن"}
                          {account.isContra ? " (مقابل)" : ""}
                        </TD>
                        <TD className="text-left"><Money value={row?.closingDebit ?? 0} currency={ctx.currency} showCurrency={false} /></TD>
                        <TD className="text-left"><Money value={row?.closingCredit ?? 0} currency={ctx.currency} showCurrency={false} /></TD>
                        <TD className={`text-left font-semibold ${closing < 0 ? "text-danger-600" : "text-ink"}`}>
                          <Money value={closing} currency={ctx.currency} />
                        </TD>
                      </TR>
                    );
                  })
                )}
              </TBody>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>

      <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted">
        <BookOpen className="h-3.5 w-3.5" />
        دليل الحسابات الحالي يحتوي {ctx.data.accounts.length} حساباً. يمكن استيراد ميزان مراجعة لإضافة الحسابات تلقائياً.
      </p>
    </>
  );
}
