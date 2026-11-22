import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";
import {
  buildBalanceSheet,
  buildCashFlowStatement,
  buildEquityStatement,
  buildIncomeStatement,
} from "@/lib/accounting/statements";
import { loadCompanyContext, resolvePeriod } from "@/lib/data/context";
import { Money } from "@/components/app/money";
import { NoCompanyState, PeriodPicker, StatementTable } from "@/components/app/blocks";
import { PrintButton } from "@/components/app/print-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "القوائم المالية" };

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="القوائم المالية" />
        <NoCompanyState />
      </>
    );
  }

  const period = resolvePeriod(params, ctx.period);
  const income = buildIncomeStatement(ctx.ledger, period);
  const balance = buildBalanceSheet(ctx.ledger, { ...period, periodStart: period.from });
  const cashFlow = buildCashFlowStatement(ctx.ledger, period);
  const equity = buildEquityStatement(ctx.ledger, period);
  const warnings = [...new Set([...income.warnings, ...balance.warnings, ...cashFlow.warnings, ...equity.warnings])];

  return (
    <>
      <PageHeader
        eyebrow={ctx.company.name}
        title="القوائم المالية"
        description={`الفترة ${period.from} إلى ${period.to} — ${ctx.currency}. جميع القيم محسوبة من القيود المرحّلة.`}
        actions={
          <>
            <PeriodPicker companyId={ctx.company.id} from={period.from} to={period.to} />
            <PrintButton />
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">صافي الإيرادات</p>
          <p className="mt-1 text-lg font-bold text-brand-900"><Money value={income.netRevenue} currency={ctx.currency} /></p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">مجمل الربح</p>
          <p className="mt-1 text-lg font-bold text-brand-900"><Money value={income.grossProfit} currency={ctx.currency} /></p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">صافي الربح</p>
          <p className={`mt-1 text-lg font-bold ${income.netProfit >= 0 ? "text-success-600" : "text-danger-600"}`}>
            <Money value={income.netProfit} currency={ctx.currency} />
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">إجمالي الأصول</p>
          <p className="mt-1 text-lg font-bold text-brand-900"><Money value={balance.totalAssets} currency={ctx.currency} /></p>
        </div>
      </div>

      {warnings.length ? (
        <div className="mb-4 space-y-2">
          {warnings.slice(0, 5).map((warning) => (
            <Alert key={warning} variant="warning" title="ملاحظة على إعداد القائمة">
              {warning}
            </Alert>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="print-page">
          <CardHeader>
            <div>
              <CardTitle>قائمة الدخل</CardTitle>
              <CardDescription>للفترة من {period.from} إلى {period.to}</CardDescription>
            </div>
            <Badge variant="teal">بالدقة العشرية</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <StatementTable lines={income.lines} currency={ctx.currency} />
          </CardContent>
        </Card>

        <Card className="print-page">
          <CardHeader>
            <div>
              <CardTitle>قائمة المركز المالي</CardTitle>
              <CardDescription>كما في {period.to}</CardDescription>
            </div>
            <Badge variant={balance.balanced ? "success" : "danger"}>
              {balance.balanced ? (
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> متوازنة</span>
              ) : (
                <span className="inline-flex items-center gap-1"><CircleAlert className="h-3 w-3" /> فرق {balance.difference.toFixed(2)}</span>
              )}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <StatementTable lines={balance.lines} currency={ctx.currency} />
          </CardContent>
        </Card>
      </div>

      {!balance.balanced ? (
        <div className="mt-4">
          <Alert variant="danger" title="معادلة المركز المالي غير متوازنة">
            الأصول {balance.totalAssets.toFixed(2)} مقابل الالتزامات وحقوق الملكية {balance.totalLiabilitiesAndEquity.toFixed(2)} — الفرق{" "}
            {balance.difference.toFixed(2)} {ctx.currency}. لا تعتمد القائمة قبل مراجعة القيود والأرصدة الافتتاحية.
          </Alert>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="print-page">
          <CardHeader>
            <div>
              <CardTitle>قائمة التدفقات النقدية</CardTitle>
              <CardDescription>الطريقة غير المباشرة — {cashFlow.available ? "بيانات كافية" : "بيانات جزئية"}</CardDescription>
            </div>
            <Badge variant={cashFlow.available ? "success" : "warning"}>
              {cashFlow.available ? "متاحة" : "تقديرية"}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {cashFlow.available ? (
              <StatementTable lines={cashFlow.lines} currency={ctx.currency} />
            ) : (
              <div className="p-5">
                <Alert variant="warning" title="قائمة التدفقات غير مكتملة">
                  {cashFlow.warnings[0] ??
                    "لا تتوفر بيانات كافية لبناء قائمة تدفقات نقدية موثوقة. ارفع كشف البنك أو القيود التفصيلية أولاً."}
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="print-page">
          <CardHeader>
            <div>
              <CardTitle>قائمة التغيرات في حقوق الملكية</CardTitle>
              <CardDescription>للفترة من {period.from} إلى {period.to}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <StatementTable lines={equity.lines} currency={ctx.currency} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">النقدية أول الفترة</p>
          <p className="mt-1 text-base font-bold text-brand-900"><Money value={cashFlow.openingCash} currency={ctx.currency} /></p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">صافي التغير</p>
          <p className="mt-1 text-base font-bold text-brand-900"><Money value={cashFlow.netChange} currency={ctx.currency} /></p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">النقدية آخر الفترة</p>
          <p className="mt-1 text-base font-bold text-brand-900"><Money value={cashFlow.closingCash} currency={ctx.currency} /></p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-white p-4 text-[10px] leading-6 text-muted">
        <p className="mb-1 flex items-center gap-1.5 font-bold text-ink">
          <AlertTriangle className="h-3.5 w-3.5 text-warning-500" />
          حدود وطريقة الإعداد
        </p>
        <p>• قائمة الدخل تُبنى على صافي الحركة لكل نوع حساب، وتُعرض المصروفات والإيرادات في اتجاهها الطبيعي.</p>
        <p>• المركز المالي يشمل ربح الفترة الحالية ضمن الأرباح المحتجزة إذا لم تُقفل الفترة. تُعرض المسحوبات كخصم من حقوق الملكية.</p>
        <p>• التدفقات النقدية تُبنى بالطريقة غير المباشرة من التغيرات في النقدية والبنك؛ لا تُعرض إذا لم تتوفر بيانات كافية.</p>
        <p>• القوائم لا تُعد رأياً محاسبياً أو تقرير مراجعة معتمداً، ويجب مراجعتها من مختص قبل الاستخدام الرسمي.</p>
      </div>
    </>
  );
}
