import type { Metadata } from "next";
import { Activity, SlidersHorizontal } from "lucide-react";
import { DEFAULT_ANOMALY_RULES, detectAnomalies } from "@/lib/accounting/anomalies";
import { loadCompanyContext, resolvePeriod } from "@/lib/data/context";
import { Money } from "@/components/app/money";
import { NoCompanyState, PeriodPicker } from "@/components/app/blocks";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TableWrap, TBody, TD, TR } from "@/components/ui/table";

export const metadata: Metadata = { title: "العمليات غير المعتادة" };

const CATEGORY_LABELS: Record<string, string> = {
  expense_spike: "ارتفاع غير معتاد",
  unusual_expense: "مصروف غير معتاد",
  repeated_amount: "مبلغ متكرر",
  outlier: "قيمة متطرفة",
  ratio_shift: "تغير في النسبة",
  documentation: "نقص مستندات",
  concentration: "تركيز المصروف",
};

export default async function AnomaliesPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="العمليات غير المعتادة" />
        <NoCompanyState />
      </>
    );
  }

  const period = resolvePeriod(params, ctx.period);
  const anomalies = detectAnomalies(ctx.ledger, period);
  const totalAmount = anomalies.reduce((sum, item) => sum + Math.abs(item.amount), 0);

  return (
    <>
      <PageHeader
        eyebrow={ctx.company.name}
        title="العمليات غير المعتادة وتحليل المصروفات"
        description="كشف آلي للارتفاعات والتكرار والتركيز ونقص المستندات باستخدام قواعد قابلة للتخصيص. النتائج للمراجعة فقط."
        actions={<PeriodPicker companyId={ctx.company.id} from={period.from} to={period.to} />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">عدد الملاحظات</p>
          <p className="mt-1 text-xl font-bold text-brand-900" dir="ltr">{anomalies.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">إجمالي المبالغ المشمولة</p>
          <p className="mt-1 text-lg font-bold text-brand-900"><Money value={totalAmount} currency={ctx.currency} /></p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">أعلى خطورة</p>
          <div className="mt-1.5">
            {anomalies.length ? <SeverityBadge severity={anomalies[0].severity} /> : <Badge variant="success">لا يوجد</Badge>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-teal-700" />
                قواعد التحليل
              </CardTitle>
              <CardDescription>القواعد الافتراضية المطبقة حالياً. التخصيص الكامل متاح في الإعدادات لاحقاً.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-[11px]">
            {[
              { label: "حد ارتفاع المصروف", value: `${DEFAULT_ANOMALY_RULES.expenseSpikeRatio}× المتوسط الشهري` },
              { label: "الحد الأدنى للارتفاع", value: `${DEFAULT_ANOMALY_RULES.expenseSpikeMinAmount} ${ctx.currency}` },
              { label: "معامل الانحراف المتطرف", value: `${DEFAULT_ANOMALY_RULES.outlierStdFactor} انحراف معياري` },
              { label: "تكرار المبلغ", value: `${DEFAULT_ANOMALY_RULES.repeatedAmountMinCount} مرات فأكثر` },
              { label: "حد المستندات", value: `أعلى من ${DEFAULT_ANOMALY_RULES.documentationThreshold} ${ctx.currency}` },
              { label: "تركيز الحساب", value: `${DEFAULT_ANOMALY_RULES.concentrationShare}% من المصروفات` },
              { label: "أقل مدة تاريخية", value: `${DEFAULT_ANOMALY_RULES.minHistoryMonths} أشهر` },
            ].map((rule) => (
              <div key={rule.label} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-1.5">
                <span className="text-muted">{rule.label}</span>
                <span className="font-semibold text-ink" dir="ltr">{rule.value}</span>
              </div>
            ))}
            <Alert variant="warning" title="حدود التحليل">
              القواعد إحصائية ولا تعرف طبيعة نشاطك بالكامل. قد تكون بعض النتائج مبررة تجارياً. راجع المستندات قبل أي
              استنتاج.
            </Alert>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {anomalies.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-6 w-6" />}
              title="لا توجد عمليات غير معتادة"
              description="لم تُكتشف قيم متطرفة أو ارتفاعات تتجاوز القواعد الحالية في الفترة المحددة."
            />
          ) : (
            anomalies.map((anomaly) => (
              <Card key={anomaly.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={anomaly.severity} />
                      <h3 className="text-sm font-bold text-ink">{anomaly.title}</h3>
                      <Badge variant="neutral">{CATEGORY_LABELS[anomaly.category] ?? anomaly.category}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted">
                      {anomaly.period ? <span dir="ltr">{anomaly.period}</span> : null}
                      <span dir="ltr" className="num font-bold text-ink">
                        {anomaly.score.toFixed(0)}/100
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 text-xs leading-6 text-ink/80">{anomaly.description}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                    {anomaly.accountName ? <span>الحساب: {anomaly.accountName}</span> : null}
                    <span>المبلغ: <Money value={anomaly.amount} currency={ctx.currency} /></span>
                  </div>

                  {anomaly.evidence.length ? (
                    <TableWrap className="mt-3">
                      <Table>
                        <TBody>
                          {anomaly.evidence.map((item) => (
                            <TR key={item.label}>
                              <TD className="w-1/2 text-[10px] text-muted">{item.label}</TD>
                              <TD className="text-[10px] font-semibold" dir="ltr">{item.value}</TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </TableWrap>
                  ) : null}

                  <ul className="mt-2 space-y-1">
                    {anomaly.reasons.map((reason) => (
                      <li key={reason} className="rounded-lg bg-surface px-2.5 py-1.5 text-[10px] leading-5 text-muted">
                        • {reason}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
