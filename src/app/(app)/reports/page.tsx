import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText, Scale, ShieldAlert } from "lucide-react";
import { buildReportData } from "@/lib/reports/build";
import { loadCompanyContext, resolvePeriod } from "@/lib/data/context";
import { monthLabel } from "@/lib/utils/dates";
import { Money } from "@/components/app/money";
import { NoCompanyState, PeriodPicker, RatioGrid, StatementTable } from "@/components/app/blocks";
import { PrintButton } from "@/components/app/print-button";
import { MonthlyPerformanceChart } from "@/components/app/charts";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateArabic } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "التقارير" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="التقارير" />
        <NoCompanyState />
      </>
    );
  }

  const period = resolvePeriod(params, ctx.period);
  const report = buildReportData({
    company: ctx.company,
    data: ctx.data,
    ledger: ctx.ledger,
    period,
  });

  const monthly = report.analysis.monthly.map((point) => ({ ...point, label: monthLabel(point.period).split(" ")[0] }));
  const exportHref = `/api/reports/export?company=${ctx.company.id}&from=${period.from}&to=${period.to}`;
  const reviewed = ctx.data.findingStates.filter((state) => state.status === "reviewed").length;

  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow={ctx.company.name}
          title="التقرير المالي الشامل"
          description="تقرير عربي احترافي قابل للطباعة والتصدير. يبدأ بالملخص التنفيذي وينتهي بحدود التحليل وإخلاء المسؤولية."
          actions={
            <>
              <PeriodPicker companyId={ctx.company.id} from={period.from} to={period.to} />
              <Button asChild variant="outline">
                <Link href={exportHref}>
                  <Download className="h-4 w-4" />
                  تصدير Excel
                </Link>
              </Button>
              <PrintButton label="طباعة / PDF" />
            </>
          }
        />
      </div>

      <div className="mx-auto max-w-4xl space-y-5">
        <section className="brand-gradient rounded-3xl p-8 text-white shadow-float print-page">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-6 flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                  <Scale className="h-5 w-5 text-teal-200" />
                </span>
                <div>
                  <p className="text-sm font-bold">ركاز</p>
                  <p className="text-[9px] tracking-[0.2em] text-teal-200/80">RAKAZ AI</p>
                </div>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-teal-200">تقرير التحليل المالي</p>
              <h1 className="mt-2 text-3xl font-bold">{report.company.name}</h1>
              <p className="mt-1 text-sm text-white/70">{report.company.legalName}</p>
              <p className="mt-4 text-xs text-white/70">
                الفترة المالية: {report.period.from} — {report.period.to} · العملة: {report.company.currency}
              </p>
              <p className="text-xs text-white/60">تاريخ الإصدار: {formatDateArabic(report.generatedAt.slice(0, 10))}</p>
            </div>
            <div className="hidden text-end text-[10px] leading-6 text-white/60 sm:block">
              <p>النشاط: {report.company.activityType}</p>
              <p>{report.company.city ?? ""}</p>
              <p>الرقم الضريبي: {report.company.taxNumber ?? "—"}</p>
            </div>
          </div>
        </section>

        <Card className="print-page">
          <CardHeader>
            <CardTitle>1. الملخص التنفيذي</CardTitle>
            <CardDescription>أهم النتائج المالية والملاحظات خلال الفترة.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm leading-7 text-ink/85">
            {report.executiveSummary.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </CardContent>
        </Card>

        <Card className="print-page">
          <CardHeader>
            <CardTitle>2. مؤشرات الأداء الرئيسية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {report.kpis.map((kpi) => (
                <div key={kpi.label} className="rounded-xl bg-surface p-3">
                  <p className="text-[10px] text-muted">{kpi.label}</p>
                  <p className="mt-1 text-sm font-bold text-brand-900" dir="ltr">{kpi.value}</p>
                  {kpi.hint ? <p className="mt-0.5 text-[9px] leading-4 text-muted">{kpi.hint}</p> : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="print-page">
          <CardHeader>
            <CardTitle>3. قائمة الدخل</CardTitle>
            <CardDescription>{report.period.from} — {report.period.to}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <StatementTable lines={report.income.lines} currency={ctx.currency} />
          </CardContent>
        </Card>

        <Card className="print-page">
          <CardHeader>
            <div>
              <CardTitle>4. قائمة المركز المالي</CardTitle>
              <CardDescription>كما في {report.period.to}</CardDescription>
            </div>
            <Badge variant={report.balance.balanced ? "success" : "danger"}>
              {report.balance.balanced ? "متوازنة" : `فرق ${report.balance.difference.toFixed(2)}`}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <StatementTable lines={report.balance.lines} currency={ctx.currency} />
          </CardContent>
        </Card>

        <Card className="print-page">
          <CardHeader>
            <div>
              <CardTitle>5. قائمة التدفقات النقدية</CardTitle>
              <CardDescription>الطريقة غير المباشرة</CardDescription>
            </div>
            <Badge variant={report.cashFlow.available ? "success" : "warning"}>
              {report.cashFlow.available ? "متاحة" : "غير مكتملة"}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {report.cashFlow.available ? (
              <StatementTable lines={report.cashFlow.lines} currency={ctx.currency} />
            ) : (
              <div className="p-4">
                <Alert variant="warning">{report.cashFlow.warnings[0] ?? "لا تتوفر بيانات كافية."}</Alert>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="print-page">
          <CardHeader>
            <CardTitle>6. قائمة التغيرات في حقوق الملكية</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <StatementTable lines={report.equity.lines} currency={ctx.currency} />
          </CardContent>
        </Card>

        <Card className="print-page">
          <CardHeader>
            <CardTitle>7. التحليل المالي والاتجاهات</CardTitle>
            <CardDescription>النسب المتاحة فقط مع معادلاتها.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MonthlyPerformanceChart data={monthly} currency={ctx.currency} />
            <RatioGrid ratios={report.analysis.ratios} />
          </CardContent>
        </Card>

        <Card className="print-page">
          <CardHeader>
            <CardTitle>8. تحليل المصروفات</CardTitle>
            <CardDescription>توزيع المصروفات حسب الحساب.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <TableWrap className="rounded-none border-0">
              <Table>
                <THead>
                  <TR>
                    <TH>الحساب</TH>
                    <TH className="text-left">المبلغ</TH>
                    <TH className="text-left">النسبة</TH>
                  </TR>
                </THead>
                <TBody>
                  {report.analysis.expenseBreakdown.map((item) => (
                    <TR key={item.code}>
                      <TD className="text-xs">{item.code} — {item.name}</TD>
                      <TD className="text-left text-[11px]"><Money value={item.amount} currency={ctx.currency} /></TD>
                      <TD className="text-left text-[11px]" dir="ltr">{item.share.toFixed(1)}%</TD>
                    </TR>
                  ))}
                  {report.analysis.expenseBreakdown.length === 0 ? (
                    <TR>
                      <TD colSpan={3} className="py-6 text-center text-xs text-muted">لا توجد مصروفات.</TD>
                    </TR>
                  ) : null}
                </TBody>
              </Table>
            </TableWrap>
          </CardContent>
        </Card>

        <Card className="print-page">
          <CardHeader>
            <div>
              <CardTitle>9. الأخطاء والملاحظات المكتشفة</CardTitle>
              <CardDescription>{report.findings.length} ملاحظة — تمت مراجعة {reviewed} منها.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <TableWrap className="rounded-none border-0">
              <Table>
                <THead>
                  <TR>
                    <TH>الخطورة</TH>
                    <TH>الملاحظة</TH>
                    <TH>الحساب / القيد</TH>
                    <TH>التوصية</TH>
                  </TR>
                </THead>
                <TBody>
                  {report.findings.slice(0, 15).map((finding) => (
                    <TR key={finding.id}>
                      <TD><SeverityBadge severity={finding.severity} /></TD>
                      <TD className="max-w-[220px] text-[11px]">{finding.title}</TD>
                      <TD className="text-[10px] text-muted" dir="ltr">
                        {finding.accountCode ?? finding.entryNumber ?? "—"}
                      </TD>
                      <TD className="max-w-[260px] text-[10px] leading-5 text-muted">{finding.recommendation}</TD>
                    </TR>
                  ))}
                  {report.findings.length === 0 ? (
                    <TR>
                      <TD colSpan={4} className="py-6 text-center text-xs text-muted">لا توجد ملاحظات.</TD>
                    </TR>
                  ) : null}
                </TBody>
              </Table>
            </TableWrap>
          </CardContent>
        </Card>

        <Card className="print-page">
          <CardHeader>
            <CardTitle>10. العمليات غير المعتادة</CardTitle>
            <CardDescription>مؤشرات إحصائية تحتاج مراجعة مستندات.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.anomalies.length ? (
              report.anomalies.slice(0, 8).map((anomaly) => (
                <div key={anomaly.id} className="rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-ink">{anomaly.title}</p>
                    <SeverityBadge severity={anomaly.severity} />
                  </div>
                  <p className="mt-1 text-[10px] leading-5 text-muted">{anomaly.description}</p>
                  <p className="mt-1 text-[10px] text-muted">
                    المبلغ: <Money value={anomaly.amount} currency={ctx.currency} /> · درجة الثقة {anomaly.score.toFixed(0)}/100
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted">لا توجد عمليات غير معتادة.</p>
            )}
          </CardContent>
        </Card>

        <Card className="print-page">
          <CardHeader>
            <CardTitle>11. القيود المكررة المحتملة</CardTitle>
            <CardDescription>لا يتم حذف أو تعديل أي قيد تلقائياً.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.duplicates.length ? (
              report.duplicates.slice(0, 6).map((group) => (
                <div key={group.id} className="rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-ink">
                      {group.entries.length} سجلات متشابهة — درجة {group.score.toFixed(0)}/100
                    </p>
                    <Badge variant={group.strength === "strong" ? "danger" : group.strength === "medium" ? "warning" : "neutral"}>
                      {group.strength === "strong" ? "اشتباه قوي" : group.strength === "medium" ? "اشتباه متوسط" : "اشتباه ضعيف"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] leading-5 text-muted">
                    {group.entries.map((entry) => `${entry.entryNumber} (${entry.date.slice(0, 10)})`).join(" · ")}
                  </p>
                  <p className="mt-1 text-[10px] leading-5 text-muted">{group.reasons.join(" | ")}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted">لا توجد مجموعات اشتباه.</p>
            )}
          </CardContent>
        </Card>

        <Card className="print-page">
          <CardHeader>
            <CardTitle>12. ملاحظات المراجعة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs leading-7 text-ink/80">
            <p>• إجمالي الملاحظات: {report.findings.length}، منها {report.findings.filter((f) => f.severity === "critical").length} حرجة.</p>
            <p>• تمت مراجعة {reviewed} ملاحظة وتوثيق حالتها في المنصة.</p>
            <p>• القيود غير المتوازنة: {report.findings.filter((f) => f.code === "UNBALANCED_ENTRY").length}.</p>
            <p>• الحسابات غير المعرّفة أو غير المصنفة: {report.findings.filter((f) => f.category === "chart_of_accounts" || f.category === "classification").length}.</p>
            <p>• الميزان {report.trial.balanced ? "متوازن" : `غير متوازن بفرق ${report.trial.difference.toFixed(2)}`}.</p>
          </CardContent>
        </Card>

        <Card className="print-page">
          <CardHeader>
            <CardTitle>13. التوصيات</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-xs leading-7 text-ink/85">
              {report.recommendations.map((recommendation, index) => (
                <li key={recommendation} className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-teal-800">
                    {index + 1}
                  </span>
                  {recommendation}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="print-page">
            <CardHeader>
              <CardTitle>14. نطاق الفحص</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-[11px] leading-6 text-muted">
              <p>• الفترة: {report.period.from} — {report.period.to}</p>
              <p>• عدد القيود المرحّلة: {report.trial.entryCount}</p>
              <p>• عدد الحسابات: {ctx.data.accounts.length}</p>
              <p>• عمليات الاستيراد: {ctx.data.batches.length}</p>
              <p>• القيود المسودة والمستبعدة غير مشمولة.</p>
            </CardContent>
          </Card>

          <Card className="print-page">
            <CardHeader>
              <CardTitle>15. مصادر البيانات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-[11px] leading-6 text-muted">
              {report.sources.map((source) => (
                <p key={source}>• {source}</p>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="print-page">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-warning-500" />
              16. القيود على التحليل وإخلاء المسؤولية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[11px] leading-6 text-muted">
            {report.limitations.map((limitation) => (
              <p key={limitation}>• {limitation}</p>
            ))}
            <div className="mt-3 rounded-xl border border-warning-100 bg-warning-50 p-3 text-warning-600">
              هذا التقرير أُعد بواسطة منصة RAKAZ AI كتحليل مساعد بناءً على البيانات المقدمة، ولا يُعد رأياً قانونياً أو
              محاسبياً مستقلاً، ولا يغني عن مراجعة محاسب قانوني مرخّص.
            </div>
          </CardContent>
        </Card>

        <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-white p-4">
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <FileText className="h-3.5 w-3.5" />
            للتصدير إلى PDF استخدم طباعة المتصفح واختر «حفظ كـ PDF».
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={exportHref}>
                <Download className="h-4 w-4" />
                تصدير Excel
              </Link>
            </Button>
            <PrintButton />
          </div>
        </div>
      </div>
    </>
  );
}
