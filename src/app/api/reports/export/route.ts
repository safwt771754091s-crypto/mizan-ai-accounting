import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertCompanyPermission } from "@/lib/auth/permissions";
import { getRepository } from "@/lib/data/repository";
import { buildReportData } from "@/lib/reports/build";
import type { StatementLine } from "@/lib/accounting/types";
import type { Ledger } from "@/lib/accounting/types";

export const runtime = "nodejs";

const BRAND = "FF0B4234";
const LIGHT = "FFEEF7F3";

function headerRow(sheet: ExcelJS.Worksheet, values: string[]) {
  const row = sheet.addRow(values);
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  row.alignment = { vertical: "middle", horizontal: "right" };
  row.height = 22;
  return row;
}

function addStatementSheet(workbook: ExcelJS.Workbook, title: string, lines: StatementLine[], currency: string) {
  const sheet = workbook.addWorksheet(title, { views: [{ rightToLeft: true }] });
  sheet.columns = [
    { header: "البيان", key: "label", width: 52 },
    { header: `المبلغ (${currency})`, key: "amount", width: 20 },
  ];
  headerRow(sheet, ["البيان", `المبلغ (${currency})`]);
  for (const line of lines) {
    const row = sheet.addRow([line.label, line.isHeader ? "" : line.amount]);
    if (line.isHeader) {
      row.font = { bold: true };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
    } else {
      row.getCell(2).numFmt = "#,##0.00;[Red]-#,##0.00";
      if (line.isTotal) row.font = { bold: true };
      row.getCell(1).alignment = { horizontal: "right", indent: line.level };
    }
  }
  return sheet;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "غير مصرح." }, { status: 401 });

  const url = new URL(request.url);
  const companyId = url.searchParams.get("company") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!companyId) return NextResponse.json({ ok: false, error: "معرّف الشركة مطلوب." }, { status: 400 });

  const repo = getRepository();
  const gate = await assertCompanyPermission(user, companyId, "reports.export");
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  const access = gate.state.access;

  const company = access.company;
  const period = {
    from: /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : company.fiscalYearStart,
    to: /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : company.fiscalYearEnd,
  };
  const data = await repo.getCompanyData(companyId);
  const ledger: Ledger = {
    accounts: data.accounts,
    entries: data.entries,
    periods: data.periods,
    currency: company.currency,
  };
  const report = buildReportData({ company, data, ledger, period });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RAKAZ AI";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("الملخص", { views: [{ rightToLeft: true }] });
  summary.columns = [
    { width: 34 },
    { width: 46 },
  ];
  summary.mergeCells("A1:B1");
  const title = summary.getCell("A1");
  title.value = `تقرير RAKAZ AI — ${company.name}`;
  title.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  summary.getRow(1).height = 32;

  summary.addRow(["الاسم القانوني", company.legalName]);
  summary.addRow(["النشاط", company.activityType]);
  summary.addRow(["العملة", company.currency]);
  summary.addRow(["الفترة", `${period.from} — ${period.to}`]);
  summary.addRow(["تاريخ الإصدار", report.generatedAt.slice(0, 10)]);
  summary.addRow([]);
  summary.addRow(["مؤشرات الأداء", ""]).font = { bold: true };
  for (const kpi of report.kpis) summary.addRow([kpi.label, kpi.value]);
  summary.addRow([]);
  summary.addRow(["الملخص التنفيذي", ""]).font = { bold: true };
  for (const paragraph of report.executiveSummary) {
    const row = summary.addRow([paragraph]);
    summary.mergeCells(`A${row.number}:B${row.number}`);
    row.alignment = { wrapText: true, horizontal: "right" };
    row.height = 44;
  }
  for (let index = 2; index <= summary.rowCount; index += 1) {
    const cell = summary.getCell(`B${index}`);
    cell.alignment = { wrapText: true, horizontal: "right" };
  }

  addStatementSheet(workbook, "قائمة الدخل", report.income.lines, company.currency);
  addStatementSheet(workbook, "المركز المالي", report.balance.lines, company.currency);
  if (report.cashFlow.available) {
    addStatementSheet(workbook, "التدفقات النقدية", report.cashFlow.lines, company.currency);
  }
  addStatementSheet(workbook, "حقوق الملكية", report.equity.lines, company.currency);

  const ratios = workbook.addWorksheet("التحليل المالي", { views: [{ rightToLeft: true }] });
  ratios.columns = [
    { header: "المؤشر", width: 30 },
    { header: "القيمة", width: 14 },
    { header: "الوحدة", width: 10 },
    { header: "المعادلة", width: 46 },
    { header: "التفسير", width: 50 },
    { header: "متاح", width: 8 },
  ];
  headerRow(ratios, ["المؤشر", "القيمة", "الوحدة", "المعادلة", "التفسير", "متاح"]);
  for (const ratio of report.analysis.ratios) {
    ratios.addRow([
      ratio.label,
      ratio.available ? ratio.value : "—",
      ratio.unit,
      ratio.formula,
      ratio.interpretation,
      ratio.available ? "نعم" : "لا",
    ]);
  }

  const findings = workbook.addWorksheet("الملاحظات", { views: [{ rightToLeft: true }] });
  findings.columns = [
    { header: "الخطورة", width: 10 },
    { header: "العنوان", width: 40 },
    { header: "الوصف", width: 60 },
    { header: "الحساب", width: 12 },
    { header: "القيد", width: 16 },
    { header: "التوصية", width: 50 },
  ];
  headerRow(findings, ["الخطورة", "العنوان", "الوصف", "الحساب", "القيد", "التوصية"]);
  for (const finding of report.findings) {
    const row = findings.addRow([
      finding.severity,
      finding.title,
      finding.description,
      finding.accountCode ?? "",
      finding.entryNumber ?? "",
      finding.recommendation,
    ]);
    row.alignment = { wrapText: true, vertical: "top" };
  }

  const duplicates = workbook.addWorksheet("القيود المكررة", { views: [{ rightToLeft: true }] });
  duplicates.columns = [
    { header: "النوع", width: 14 },
    { header: "درجة الاشتباه", width: 14 },
    { header: "القوة", width: 12 },
    { header: "القيود", width: 50 },
    { header: "الأسباب", width: 60 },
    { header: "التوصية", width: 50 },
  ];
  headerRow(duplicates, ["النوع", "درجة الاشتباه", "القوة", "القيود", "الأسباب", "التوصية"]);
  for (const group of report.duplicates) {
    duplicates.addRow([
      group.kind,
      group.score,
      group.strength,
      group.entries.map((entry) => `${entry.entryNumber} (${entry.date.slice(0, 10)})`).join(" | "),
      group.reasons.join(" | "),
      group.recommendation,
    ]).alignment = { wrapText: true, vertical: "top" };
  }

  const recommendations = workbook.addWorksheet("التوصيات", { views: [{ rightToLeft: true }] });
  recommendations.columns = [{ header: "التوصية", width: 100 }];
  headerRow(recommendations, ["التوصية"]);
  for (const recommendation of report.recommendations) {
    recommendations.addRow([recommendation]).alignment = { wrapText: true, horizontal: "right" };
  }
  recommendations.addRow([]);
  recommendations.addRow(["مصادر البيانات"]).font = { bold: true };
  for (const source of report.sources) recommendations.addRow([source]);
  recommendations.addRow([]);
  recommendations.addRow(["القيود على التحليل"]).font = { bold: true };
  for (const limitation of report.limitations) recommendations.addRow([limitation]);

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `rakaz-report-${company.id}-${period.from}-${period.to}.xlsx`;

  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
