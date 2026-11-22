import Link from "next/link";
import type { Metadata } from "next";
import { FileSpreadsheet, Upload } from "lucide-react";
import { loadCompanyContext } from "@/lib/data/context";
import { NoCompanyState, PeriodPicker } from "@/components/app/blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateArabic } from "@/lib/utils/dates";
import { DATASET_SCHEMAS } from "@/lib/import/datasets";
import type { ImportDataset } from "@/lib/import/types";

export const metadata: Metadata = { title: "بيانات المحاسبة المستوردة" };

const STATUS_LABELS: Record<string, string> = { completed: "مكتمل", partial: "جزئي", failed: "فاشل" };

export default async function ImportsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; batch?: string }>;
}) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="بيانات المحاسبة المستوردة" />
        <NoCompanyState />
      </>
    );
  }

  const { data, company } = ctx;
  const selected = params.batch ? data.batches.find((b) => b.id === params.batch) ?? null : null;
  const records = selected ? data.records.filter((record) => record.batchId === selected.id) : [];
  const totalRows = data.batches.reduce((sum, batch) => sum + batch.rowCount, 0);

  return (
    <>
      <PageHeader
        eyebrow={company.name}
        title="بيانات المحاسبة المستوردة"
        description="سجل كامل لعمليات الاستيراد ومصدر كل سجل. يمكنك فتح أي عملية لمراجعة الصفوف المحفوظة."
        actions={
          <Button asChild variant="teal">
            <Link href={`/upload?company=${company.id}`}>
              <Upload className="h-4 w-4" />
              رفع ملف جديد
            </Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">عمليات الاستيراد</p>
          <p className="mt-1 text-xl font-bold text-brand-900" dir="ltr">{data.batches.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">إجمالي الصفوف المستوردة</p>
          <p className="mt-1 text-xl font-bold text-brand-900" dir="ltr">{totalRows}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">السجلات المحفوظة</p>
          <p className="mt-1 text-xl font-bold text-brand-900" dir="ltr">{data.records.length}</p>
        </div>
      </div>

      {data.batches.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet className="h-6 w-6" />}
          title="لا يوجد استيراد بعد"
          description="ارفع ملف ميزان المراجعة أو القيود لبدء التحليل. يمكنك تجربة الملفات التجريبية من صفحة الرفع."
          action={
            <Button asChild>
              <Link href={`/upload?company=${company.id}`}>رفع ملف</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>سجل الاستيراد</CardTitle>
              <CardDescription>كل عملية مرتبطة بملف وبصمة وتاريخ ومستخدم.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <TableWrap className="rounded-none border-0">
              <Table>
                <THead>
                  <TR>
                    <TH>الملف</TH>
                    <TH>النوع</TH>
                    <TH>الورقة</TH>
                    <TH>الصفوف</TH>
                    <TH>المستورد</TH>
                    <TH>الحالة</TH>
                    <TH>التاريخ</TH>
                    <TH></TH>
                  </TR>
                </THead>
                <TBody>
                  {data.batches.map((batch) => (
                    <TR key={batch.id}>
                      <TD className="max-w-[220px] truncate text-xs font-semibold">{batch.fileName}</TD>
                      <TD className="text-[11px]">{DATASET_SCHEMAS[batch.dataset as ImportDataset]?.label ?? batch.dataset}</TD>
                      <TD className="text-[11px] text-muted">{batch.sheetName}</TD>
                      <TD className="text-[11px]" dir="ltr">{batch.rowCount}</TD>
                      <TD className="text-[11px]" dir="ltr">{batch.importedCount}</TD>
                      <TD>
                        <Badge
                          variant={batch.status === "completed" ? "success" : batch.status === "partial" ? "warning" : "danger"}
                        >
                          {STATUS_LABELS[batch.status]}
                        </Badge>
                      </TD>
                      <TD className="whitespace-nowrap text-[11px] text-muted">{formatDateArabic(batch.createdAt.slice(0, 10))}</TD>
                      <TD>
                        <Link
                          href={`/imports?company=${company.id}&batch=${batch.id}`}
                          className="text-[11px] font-bold text-teal-700 hover:underline"
                        >
                          مراجعة
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </CardContent>
        </Card>
      )}

      {selected ? (
        <Card className="mt-4">
          <CardHeader>
            <div>
              <CardTitle>تفاصيل العملية: {selected.fileName}</CardTitle>
              <CardDescription>
                {DATASET_SCHEMAS[selected.dataset as ImportDataset]?.label} · {selected.rowCount} صف · بصمة{" "}
                <code dir="ltr" className="font-mono">{selected.checksum.slice(0, 12)}…</code>
              </CardDescription>
            </div>
            <Link href={`/imports?company=${company.id}`} className="text-[11px] font-bold text-teal-700 hover:underline">
              إغلاق
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {selected.warnings.length ? (
              <div className="space-y-1.5">
                {selected.warnings.map((warning) => (
                  <Alert key={warning} variant="warning">{warning}</Alert>
                ))}
              </div>
            ) : null}
            {records.length ? (
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      <TH>الصف</TH>
                      {Object.keys(records[0].data).slice(0, 8).map((key) => (
                        <TH key={key}>{key}</TH>
                      ))}
                    </TR>
                  </THead>
                  <TBody>
                    {records.slice(0, 200).map((record) => (
                      <TR key={record.id}>
                        <TD className="text-[10px] text-muted" dir="ltr">{record.rowNumber}</TD>
                        {Object.keys(records[0].data).slice(0, 8).map((key) => (
                          <TD key={key} className="max-w-[180px] truncate text-[11px]">
                            {record.data[key] ?? ""}
                          </TD>
                        ))}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            ) : (
              <Alert variant="info">
                هذه العملية أنشأت قيوداً أو حسابات مباشرة، ولا تحتوي سجلات خام محفوظة. يمكنك مراجعة القيود من صفحة دفتر
                الأستاذ.
              </Alert>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-4">
        <PeriodPicker companyId={company.id} from={ctx.period.from} to={ctx.period.to} />
      </div>
    </>
  );
}
