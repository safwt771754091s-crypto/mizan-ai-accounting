import type { Metadata } from "next";
import { TrendingDown, TrendingUp } from "lucide-react";
import { buildFinancialAnalysis, buildTrends } from "@/lib/accounting/ratios";
import { loadCompanyContext, resolvePeriod } from "@/lib/data/context";
import { monthLabel } from "@/lib/utils/dates";
import { Money } from "@/components/app/money";
import { ChangeBadge, NoCompanyState, PeriodPicker, RatioGrid } from "@/components/app/blocks";
import { BalanceBarsChart, ExpenseDonutChart, MonthlyPerformanceChart, RatioBarChart } from "@/components/app/charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader, SectionTitle } from "@/components/ui/misc";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata: Metadata = { title: "التحليل المالي" };

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="التحليل المالي" />
        <NoCompanyState />
      </>
    );
  }

  const period = resolvePeriod(params, ctx.period);
  const analysis = buildFinancialAnalysis(ctx.ledger, period);
  const trends = buildTrends(analysis);
  const monthly = analysis.monthly.map((point) => ({ ...point, label: monthLabel(point.period).split(" ")[0] }));
  const percentRatios = analysis.ratios.filter((ratio) => ratio.unit === "percent" && ratio.available);

  return (
    <>
      <PageHeader
        eyebrow={ctx.company.name}
        title="التحليل المالي"
        description={`الفترة ${period.from} إلى ${period.to}. كل نسبة معروضة مع معادلتها وتفسيرها، ولا تُعرض النسب التي لا تكفي البيانات لحسابها.`}
        actions={<PeriodPicker companyId={ctx.company.id} from={period.from} to={period.to} />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">تغير الإيرادات</p>
          <div className="mt-1 flex items-center gap-2">
            <ChangeBadge value={analysis.revenueChange} />
            {analysis.revenueChange !== null && analysis.revenueChange >= 0 ? (
              <TrendingUp className="h-4 w-4 text-success-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-danger-600" />
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted">مقارنة بالفترة السابقة المماثلة</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">تغير المصروفات</p>
          <div className="mt-1"><ChangeBadge value={analysis.expenseChange} /></div>
          <p className="mt-1 text-[10px] text-muted">ارتفاع المصروفات قد يستدعي مراجعة بنودها</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">تغير صافي الربح</p>
          <div className="mt-1"><ChangeBadge value={analysis.profitChange} /></div>
          <p className="mt-1 text-[10px] text-muted">مقارنة بالفترة السابقة المماثلة</p>
        </div>
      </div>

      {analysis.warnings.length ? (
        <div className="mb-4 space-y-2">
          {analysis.warnings.map((warning) => (
            <Alert key={warning} variant="warning" title="حد على التحليل">{warning}</Alert>
          ))}
        </div>
      ) : null}

      <Card className="mb-4">
        <CardHeader>
          <div>
            <CardTitle>الاتجاه الشهري</CardTitle>
            <CardDescription>الإيرادات والمصروفات وصافي الربح شهرياً خلال الفترة.</CardDescription>
          </div>
          <Badge variant="neutral">{monthly.length} شهر</Badge>
        </CardHeader>
        <CardContent>
          <MonthlyPerformanceChart data={monthly} currency={ctx.currency} />
        </CardContent>
      </Card>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>أهم النسب المالية</CardTitle>
              <CardDescription>النسب المئوية المتاحة فقط، مع المعادلة المستخدمة.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <RatioBarChart
              data={percentRatios.map((ratio) => ({ name: ratio.label, value: ratio.value }))}
            />
            <div className="mt-3 space-y-1.5">
              {percentRatios.slice(0, 4).map((ratio) => (
                <p key={ratio.key} className="rounded-lg bg-surface px-2.5 py-1.5 text-[10px] leading-5 text-muted">
                  <span className="font-bold text-ink">{ratio.label}:</span> {ratio.formula}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>توزيع المصروفات</CardTitle>
              <CardDescription>حسب الحساب ونسبته من إجمالي المصروفات.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {analysis.expenseBreakdown.length ? (
              <>
                <ExpenseDonutChart
                  data={analysis.expenseBreakdown.map((item) => ({ name: item.name, amount: item.amount }))}
                  currency={ctx.currency}
                />
                <div className="mt-2 space-y-1">
                  {analysis.expenseBreakdown.slice(0, 4).map((item) => (
                    <div key={item.code} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-ink">{item.name}</span>
                      <span className="flex items-center gap-2">
                        <Money value={item.amount} currency={ctx.currency} />
                        <span dir="ltr" className="num text-muted">{item.share.toFixed(1)}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-10 text-center text-xs text-muted">لا توجد مصروفات في الفترة.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <SectionTitle hint="كل نسبة تعرض المعادلة والتفسير وحدود الاستخدام">النسب التفصيلية</SectionTitle>
      <RatioGrid ratios={analysis.ratios} />

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>المقارنة الشهرية</CardTitle>
              <CardDescription>نمو الإيرادات شهرياً مقارنة بالشهر السابق.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <BalanceBarsChart
              data={trends
                .filter((point) => point.revenueGrowth !== null)
                .slice(-6)
                .map((point) => ({ name: monthLabel(point.period).split(" ")[0], value: point.revenueGrowth ?? 0 }))}
              currency={ctx.currency}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>جدول المؤشرات</CardTitle>
              <CardDescription>أرقام الفترة الحالية والسابقة والتغير.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <TableWrap className="rounded-none border-0">
              <Table>
                <THead>
                  <TR>
                    <TH>المؤشر</TH>
                    <TH className="text-left">القيمة</TH>
                    <TH>المعادلة</TH>
                  </TR>
                </THead>
                <TBody>
                  {analysis.ratios.map((ratio) => (
                    <TR key={ratio.key}>
                      <TD className="text-xs font-semibold">{ratio.label}</TD>
                      <TD className="text-left text-[11px]">
                        {ratio.available && ratio.value !== null ? (
                          <span dir="ltr" className="num">
                            {ratio.unit === "percent"
                              ? `${ratio.value.toFixed(1)}%`
                              : ratio.unit === "days"
                                ? `${ratio.value.toFixed(0)} يوم`
                                : ratio.value.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TD>
                      <TD className="text-[10px] text-muted">{ratio.formula}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
