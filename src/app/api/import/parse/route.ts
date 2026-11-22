import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRepository } from "@/lib/data/repository";
import { parseWorkbook } from "@/lib/import/parse";
import { schemaFor } from "@/lib/import/datasets";
import { suggestMapping } from "@/lib/import/detect";
import { detectFileKind, sha256, validateFileSignature } from "@/lib/import/checksum";
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/lib/supabase/config";
import type { ImportDataset } from "@/lib/import/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const PREVIEW_ROWS = 40;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "غير مصرح. سجّل الدخول أولاً." }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "تعذر قراءة الطلب." }, { status: 400 });
  }

  const file = formData.get("file");
  const dataset = String(formData.get("dataset") ?? "");
  const companyId = String(formData.get("companyId") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "لم يتم إرفاق ملف." }, { status: 400 });
  }
  if (!companyId) return NextResponse.json({ ok: false, error: "معرّف الشركة مطلوب." }, { status: 400 });

  const repo = getRepository();
  const access = await repo.getCompanyAccess(user.id, companyId);
  if (!access) return NextResponse.json({ ok: false, error: "لا تملك صلاحية الوصول إلى هذه الشركة." }, { status: 403 });
  if (access.role === "viewer" || access.role === "auditor") {
    return NextResponse.json({ ok: false, error: "دورك الحالي لا يسمح برفع الملفات." }, { status: 403 });
  }

  const validDatasets = [
    "trial_balance",
    "general_ledger",
    "journal_entries",
    "sales",
    "purchases",
    "expenses",
    "customers",
    "suppliers",
    "inventory",
    "bank_statement",
  ];
  if (!validDatasets.includes(dataset)) {
    return NextResponse.json({ ok: false, error: "نوع البيانات المختار غير صالح." }, { status: 400 });
  }

  if (file.size === 0) return NextResponse.json({ ok: false, error: "الملف فارغ." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: `حجم الملف يتجاوز الحد المسموح (${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} ميجابايت).` },
      { status: 413 },
    );
  }

  const kind = detectFileKind(file.name);
  if (!kind || !ALLOWED_EXTENSIONS.includes(kind)) {
    return NextResponse.json({ ok: false, error: "امتداد الملف غير مدعوم. المسموح: XLSX, XLS, CSV, PDF." }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const signature = validateFileSignature(buffer, kind);
  if (!signature.ok) return NextResponse.json({ ok: false, error: signature.error }, { status: 415 });

  const schema = schemaFor(dataset as ImportDataset);

  try {
    const workbook = await parseWorkbook({ buffer, fileName: file.name, kind });
    if (!workbook.sheets.length) {
      return NextResponse.json(
        { ok: false, error: "لم يتم العثور على بيانات قابلة للقراءة في الملف.", warnings: workbook.warnings },
        { status: 422 },
      );
    }

    const sheets = workbook.sheets.map((sheet) => {
      const suggestion = suggestMapping(sheet, schema);
      return {
        index: sheet.index,
        name: sheet.name,
        headers: sheet.headers,
        preview: sheet.rows.slice(0, PREVIEW_ROWS),
        totalRows: sheet.totalRows,
        truncated: sheet.truncated,
        suggestion,
      };
    });

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      kind,
      sizeBytes: buffer.length,
      checksum: sha256(buffer),
      parser: workbook.parser,
      warnings: workbook.warnings,
      sheets,
      schema: {
        dataset: schema.dataset,
        label: schema.label,
        description: schema.description,
        fields: schema.fields.map((field) => ({
          key: field.key,
          label: field.label,
          type: field.type,
          required: field.required,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحليل الملف.";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
