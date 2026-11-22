import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { accountBalancesAt, computeMovements, filterEntries } from "@/lib/accounting/engine";
import { normalBalanceOf } from "@/lib/accounting/accounts";
import { dec, money } from "@/lib/accounting/money";
import { loadCompanyContext, resolvePeriod } from "@/lib/data/context";
import { Money } from "@/components/app/money";
import { NoCompanyState, PeriodPicker } from "@/components/app/blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { EmptyRow, Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Select } from "@/components/ui/input";
import { formatDateArabic } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "دفتر الأستاذ" };

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; account?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="دفتر الأستاذ" />
        <NoCompanyState />
      </>
    );
  }

  const period = resolvePeriod(params, ctx.period);
  const movements = computeMovements(ctx.ledger, period);
  const withActivity = [...movements.movements.values()].filter(
    (m) => !m.openingDebit.isZero() || !m.openingCredit.isZero() || !m.debit.isZero() || !m.credit.isZero(),
  );
  const selectedCode = params.account && movements.movements.has(params.account) ? params.account : withActivity[0]?.code ?? "";
  const selected = movements.movements.get(selectedCode);
  const account = selected?.account ?? ctx.data.accounts.find((a) => a.code === selectedCode) ?? null;

  const previous = accountBalancesAt(ctx.ledger, period.from === "0000-01-01" ? period.from : new Date(new Date(`${period.from}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10));
  const openingNet = previous.get(selectedCode)?.net ?? dec(0);

  const entries = filterEntries(ctx.ledger.entries, { from: period.from, to: period.to, includeDraft: false, includeVoid: false })
    .filter((entry) => entry.lines.some((line) => line.accountCode?.trim() === selectedCode))
    .sort((a, b) => a.date.localeCompare(b.date) || a.entryNumber.localeCompare(b.entryNumber));

  const rows: Array<{ entry: (typeof entries)[number]; line: (typeof entries)[number]["lines"][number]; running: number }> = [];
  let balance = openingNet;
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (line.accountCode?.trim() !== selectedCode) continue;
      balance = balance.plus(dec(line.debit)).minus(dec(line.credit));
      rows.push({ entry, line, running: money(balance) });
    }
  }
  const closingBalance = money(balance);

  const normal = account ? normalBalanceOf(account) : "debit";

  return (
    <>
      <PageHeader
        eyebrow={ctx.company.name}
        title="دفتر الأستاذ"
        description={`حركات الحساب خلال الفترة ${period.from} إلى ${period.to} مع الرصيد التراكمي.`}
        actions={<PeriodPicker companyId={ctx.company.id} from={period.from} to={period.to} extra={selectedCode ? { account: selectedCode } : undefined} />}
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="company" value={ctx.company.id} />
            <input type="hidden" name="from" value={period.from} />
            <input type="hidden" name="to" value={period.to} />
            <label className="text-[11px] font-semibold text-muted">
              الحساب
              <Select name="account" defaultValue={selectedCode} className="mt-1 h-9 w-72 text-xs">
                {withActivity.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.code} — {m.account?.name ?? "حساب غير معرّف"}
                  </option>
                ))}
              </Select>
            </label>
            <Button type="submit" variant="secondary" size="sm">عرض</Button>
          </form>
          {account ? (
            <div className="ms-auto flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{account.code}</Badge>
              <Badge variant="teal">{account.type === "asset" ? "أصول" : account.type === "liability" ? "التزامات" : account.type === "equity" ? "حقوق ملكية" : account.type === "revenue" ? "إيرادات" : "مصروفات"}</Badge>
              <span className="text-[11px] text-muted">الطبيعة: {normal === "debit" ? "مدين" : "دائن"}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!selectedCode ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="لا توجد حركات في الفترة"
          description="جرّب توسيع الفترة أو رفع ملف قيود أو ميزان مراجعة."
        />
      ) : (
        <>
          <div className="mb-3 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[11px] text-muted">الرصيد الافتتاحي</p>
              <p className="mt-1 text-base font-bold text-brand-900"><Money value={money(openingNet)} currency={ctx.currency} /></p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[11px] text-muted">إجمالي المدين</p>
              <p className="mt-1 text-base font-bold text-brand-900"><Money value={money(selected?.debit ?? 0)} currency={ctx.currency} /></p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[11px] text-muted">إجمالي الدائن</p>
              <p className="mt-1 text-base font-bold text-brand-900"><Money value={money(selected?.credit ?? 0)} currency={ctx.currency} /></p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[11px] text-muted">الرصيد الختامي</p>
              <p className={`mt-1 text-base font-bold ${closingBalance < 0 ? "text-danger-600" : "text-brand-900"}`}>
                <Money value={closingBalance} currency={ctx.currency} />
              </p>
            </div>
          </div>

          {account && account.type === "asset" && closingBalance < 0 ? (
            <div className="mb-3">
              <Alert variant="warning" title="رصيد غير طبيعي">
                هذا الحساب من نوع الأصول ويظهر برصيد دائن. راجع القيود المؤثرة عليه.
              </Alert>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>{account?.name ?? "حساب غير معرّف"} — {selectedCode}</CardTitle>
                <CardDescription>{rows.length} حركة في الفترة المحددة.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <TableWrap className="rounded-none border-0">
                <Table>
                  <THead>
                    <TR>
                      <TH>التاريخ</TH>
                      <TH>رقم القيد</TH>
                      <TH>البيان</TH>
                      <TH>المصدر</TH>
                      <TH className="text-left">مدين</TH>
                      <TH className="text-left">دائن</TH>
                      <TH className="text-left">الرصيد</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {rows.length === 0 ? (
                      <EmptyRow colSpan={7} message="لا توجد حركات لهذا الحساب في الفترة." />
                    ) : (
                      rows.map(({ entry, line, running: balance }) => (
                        <TR key={`${entry.id}-${line.id ?? line.accountCode}`}>
                          <TD className="whitespace-nowrap text-[11px] text-muted">{formatDateArabic(entry.date.slice(0, 10))}</TD>
                          <TD className="whitespace-nowrap text-[11px] font-semibold" dir="ltr">{entry.entryNumber}</TD>
                          <TD className="max-w-[280px]">
                            <p className="truncate text-xs">{line.description ?? entry.description}</p>
                            {entry.reference ? <p className="text-[10px] text-muted" dir="ltr">{entry.reference}</p> : null}
                          </TD>
                          <TD className="text-[10px] text-muted">{entry.source}</TD>
                          <TD className="text-left text-[11px]"><Money value={Number(line.debit)} currency={ctx.currency} showCurrency={false} /></TD>
                          <TD className="text-left text-[11px]"><Money value={Number(line.credit)} currency={ctx.currency} showCurrency={false} /></TD>
                          <TD className={`text-left text-[11px] font-semibold ${balance < 0 ? "text-danger-600" : "text-ink"}`}>
                            <Money value={balance} currency={ctx.currency} showCurrency={false} />
                          </TD>
                        </TR>
                      ))
                    )}
                  </TBody>
                </Table>
              </TableWrap>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
