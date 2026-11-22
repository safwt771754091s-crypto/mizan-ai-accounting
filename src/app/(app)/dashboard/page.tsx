import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowLeft,
  Copy,
  FileText,
  Receipt,
  ShieldAlert,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";
import { buildTrialBalance } from "@/lib/accounting/engine";
import { buildBalanceSheet, buildIncomeStatement } from "@/lib/accounting/statements";
import { buildFinancialAnalysis } from "@/lib/accounting/ratios";
import { detectAuditFindings } from "@/lib/accounting/findings";
import { detectDuplicates } from "@/lib/accounting/duplicates";
import { loadCompanyContext, resolvePeriod } from "@/lib/data/context";
import { monthLabel } from "@/lib/utils/dates";
import { Money } from "@/components/app/money";
import { FindingsTable, NoCompanyState, PeriodPicker } from "@/components/app/blocks";
import { ExpenseDonutChart, MonthlyPerformanceChart } from "@/components/app/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader, StatCard } from "@/components/ui/misc";

export const metadata: Metadata = { title: "لوحة التحكم" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="لوحة التحكم" description="نظرة شاملة على الأداء المالي لشركتك." />
        <NoCompanyState />
      </>
    );
  }

  const { ledger, company, currency, data, role } = ctx;
  const period = resolvePeriod(params, ctx.period);
  const income = buildIncomeStatement(ledger, period);
  const balance = buildBalanceSheet(ledger, { ...period, periodStart: period.from });
  const analysis = buildFinancialAnalysis(ledger, period);
  const trial = buildTrialBalance(ledger, period);
  const findings = detectAuditFindings(ledger, period);
  const duplicates = detectDuplicates(ledger, period);
  const critical = findings.filter((f) => f.severity === "critical" || f.severity === "high");

  const monthly = analysis.monthly.map((point) => ({
    ...point,
    label: monthLabel(point.period).split(" ")[0],
  }));

  return (
    <>
      <PageHeader
        eyebrow={`${company.name} · ${company.currency}`}
        title="لوحة التحكم"
        description={`نظرة شاملة على أداء ${company.name} للفترة ${period.from} إلى ${period.to}. جميع الأرقام محسوبة من القيود المرحّلة.`}
        actions={
          <>
            <PeriodPicker companyId={company.id} from={period.from} to={period.to} />
            <Button asChild variant="outline">
              <Link href={`/reports?company=${company.id}`}>
                <FileText className="h-4 w-4" />
                التقرير
              </Link>
            </Button>
            <Button asChild variant="teal">
              <Link href={`/upload?company=${company.id}`}>
                <Upload className="h-4 w-4" />
                رفع ملف
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="صافي الإيرادات"
          value={<Money value={income.netRevenue} currency={currency} />}
          hint="بعد مردودات المبيعات"
          trend={{ value: analysis.revenueChange }}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="صافي الربح"
          value={<Money value={income.netProfit} currency={currency} />}
          hint={`هامش ${((income.netProfit / Math.max(1, income.netRevenue)) * 100).toFixed(1)}%`}
          trend={{ value: analysis.profitChange }}
          tone={income.netProfit >= 0 ? "success" : "danger"}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="النقدية والبنك"
          value={<Money value={balance.cash + balance.bank} currency={currency} />}
          hint="الأرصدة حتى نهاية الفترة"
          icon={<Receipt className="h-4 w-4" />}
        />
        <StatCard
          label="الملاحظات الحرجة"
          value={<span dir="ltr">{critical.length}</span>}
          hint={`${duplicates.length} مجموعة اشتباه تكرار`}
          tone={critical.length > 0 ? "danger" : "success"}
          icon={<ShieldAlert className="h-4 w-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>الأداء الشهري</CardTitle>
              <CardDescription>الإيرادات والمصروفات وصافي الربح لكل شهر في الفترة المحددة.</CardDescription>
            </div>
            <Badge variant={trial.balanced ? "success" : "danger"}>
              {trial.balanced ? "ميزان المراجعة متوازن" : `فرق ${trial.difference.toFixed(2)}`}
            </Badge>
          </CardHeader>
          <CardContent>
            <MonthlyPerformanceChart data={monthly} currency={currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>توزيع المصروفات</CardTitle>
              <CardDescription>أكبر ستة حسابات مصروفات حسب المبلغ.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {analysis.expenseBreakdown.length ? (
              <ExpenseDonutChart
                data={analysis.expenseBreakdown.map((item) => ({ name: item.name, amount: item.amount }))}
                currency={currency}
              />
            ) : (
              <p className="py-10 text-center text-xs text-muted">لا توجد مصروفات مسجلة في الفترة.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>مؤشرات سريعة</CardTitle>
              <CardDescription>نسب محسوبة من البيانات الفعلية.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {analysis.ratios.slice(0, 6).map((ratio) => (
              <div key={ratio.key} className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2">
                <span className="text-[11px] text-ink">{ratio.label}</span>
                <span dir="ltr" className="num text-xs font-bold text-brand-900">
                  {ratio.available && ratio.value !== null
                    ? ratio.unit === "percent"
                      ? `${ratio.value.toFixed(1)}%`
                      : ratio.value.toFixed(2)
                    : "—"}
                </span>
              </div>
            ))}
            <Link href={`/analysis?company=${company.id}`} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:underline">
              التحليل المالي الكامل
              <ArrowLeft className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>أهم الملاحظات</CardTitle>
              <CardDescription>أعلى ثلاث ملاحظات حسب الخطورة. راجع المستندات قبل أي إجراء.</CardDescription>
            </div>
            <Link href={`/findings?company=${company.id}`} className="text-[11px] font-bold text-teal-700 hover:underline">
              كل الملاحظات
            </Link>
          </CardHeader>
          <CardContent>
            {critical.length ? (
              <FindingsTable
                findings={critical.slice(0, 3)}
                companyId={company.id}
                currency={currency}
                states={data.findingStates}
                canReview={role !== "viewer"}
                compact
              />
            ) : (
              <Alert variant="success" title="لا توجد ملاحظات حرجة">
                لم يكتشف المحرك قيوداً غير متوازنة أو أرصدة غير طبيعية في الفترة المحددة. راجع بقية الفئات للتأكد.
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href={`/duplicates?company=${company.id}`} className="rounded-2xl border border-line bg-white p-4 hover:border-teal-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-ink">قيود مكررة محتملة</p>
            <Copy className="h-4 w-4 text-warning-500" />
          </div>
          <p className="mt-1 text-lg font-bold text-brand-900" dir="ltr">{duplicates.length}</p>
          <p className="text-[10px] text-muted">مجموعات اشتباه — لا حذف تلقائي</p>
        </Link>
        <Link href={`/anomalies?company=${company.id}`} className="rounded-2xl border border-line bg-white p-4 hover:border-teal-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-ink">عمليات غير معتادة</p>
            <AlertTriangle className="h-4 w-4 text-warning-500" />
          </div>
          <p className="mt-1 text-lg font-bold text-brand-900" dir="ltr">
            {analysis.warnings.length}
          </p>
          <p className="text-[10px] text-muted">ملاحظات تحليلية تحتاج مراجعة</p>
        </Link>
        <Link href={`/statements?company=${company.id}`} className="rounded-2xl border border-line bg-white p-4 hover:border-teal-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-ink">المركز المالي</p>
            <FileText className="h-4 w-4 text-teal-600" />
          </div>
          <p className="mt-1 text-lg font-bold text-brand-900">
            <Money value={balance.totalAssets} currency={currency} compact />
          </p>
          <p className="text-[10px] text-muted">إجمالي الأصول</p>
        </Link>
        <Link href={`/assistant?company=${company.id}`} className="rounded-2xl border border-line bg-white p-4 hover:border-teal-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-ink">المساعد الذكي</p>
            <TrendingUp className="h-4 w-4 text-teal-600" />
          </div>
          <p className="mt-1 text-lg font-bold text-brand-900">اسأل عن أرقامك</p>
          <p className="text-[10px] text-muted">إجابات من بيانات شركتك فقط</p>
        </Link>
      </div>

      {analysis.warnings.length ? (
        <div className="mt-4 space-y-2">
          {analysis.warnings.slice(0, 3).map((warning) => (
            <Alert key={warning} variant="warning" title="ملاحظة على جودة البيانات">
              {warning}
            </Alert>
          ))}
        </div>
      ) : null}

      <p className="mt-6 text-[10px] leading-5 text-muted">
        هذه اللوحة تعرض تحليلاً مساعداً مبنيّاً على القيود المرحّلة فقط. القيود المسودة والمستبعدة لا تدخل في
        الحسابات. آخر تحديث للبيانات: {data.batches[0]?.createdAt ? data.batches[0].createdAt.slice(0, 10) : "لا يوجد استيراد"}.
      </p>
    </>
  );
}
