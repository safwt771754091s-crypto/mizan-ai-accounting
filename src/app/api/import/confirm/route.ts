import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRepository } from "@/lib/data/repository";
import { parseWorkbook } from "@/lib/import/parse";
import { schemaFor } from "@/lib/import/datasets";
import { validateRows } from "@/lib/import/validate";
import { buildImportPlan } from "@/lib/import/plan";
import { detectFileKind, sha256, validateFileSignature } from "@/lib/import/checksum";
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/lib/supabase/config";
import { importConfirmSchema } from "@/lib/validation/schemas";
import type { ImportDataset } from "@/lib/import/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "غير مصرح." }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "تعذر قراءة الطلب." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "لم يتم إرفاق ملف." }, { status: 400 });

  let mappingInput: unknown = {};
  try {
    mappingInput = JSON.parse(String(formData.get("mapping") ?? "{}"));
  } catch {
    return NextResponse.json({ ok: false, error: "ربط الأعمدة غير صالح." }, { status: 400 });
  }

  const parsed = importConfirmSchema.safeParse({
    companyId: String(formData.get("companyId") ?? ""),
    dataset: String(formData.get("dataset") ?? ""),
    fileName: file.name,
    fileKind: String(formData.get("fileKind") ?? ""),
    sizeBytes: file.size,
    checksum: String(formData.get("checksum") ?? ""),
    sheetName: String(formData.get("sheetName") ?? ""),
    mapping: mappingInput,
    rows: [],
    issues: [],
    warnings: [],
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "بيانات الطلب غير مكتملة أو غير صالحة.", details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const dataset = input.dataset as ImportDataset;
  const sheetIndex = Number(formData.get("sheetIndex") ?? 0);

  if (!Number.isInteger(sheetIndex) || sheetIndex < 0) {
    return NextResponse.json({ ok: false, error: "ورقة العمل المحددة غير صالحة." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: "حجم الملف غير مسموح." }, { status: 413 });
  }
  const kind = detectFileKind(file.name);
  if (!kind || !ALLOWED_EXTENSIONS.includes(kind) || kind !== input.fileKind) {
    return NextResponse.json({ ok: false, error: "نوع الملف غير مطابق." }, { status: 415 });
  }

  const repo = getRepository();
  const access = await repo.getCompanyAccess(user.id, input.companyId);
  if (!access) return NextResponse.json({ ok: false, error: "لا تملك صلاحية الوصول إلى هذه الشركة." }, { status: 403 });
  if (access.role === "viewer" || access.role === "auditor") {
    return NextResponse.json({ ok: false, error: "دورك الحالي لا يسمح بالاستيراد." }, { status: 403 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const signature = validateFileSignature(buffer, kind);
  if (!signature.ok) return NextResponse.json({ ok: false, error: signature.error }, { status: 415 });

  const checksum = sha256(buffer);
  if (checksum !== input.checksum) {
    return NextResponse.json({ ok: false, error: "تغيّر الملف بعد المعاينة. أعد رفعه من جديد." }, { status: 409 });
  }

  const schema = schemaFor(dataset);
  const validKeys = new Set(schema.fields.map((field) => field.key));
  for (const key of Object.keys(input.mapping)) {
    if (!validKeys.has(key)) {
      return NextResponse.json({ ok: false, error: "ربط الأعمدة يحتوي حقولاً غير معروفة." }, { status: 400 });
    }
  }

  try {
    const workbook = await parseWorkbook({ buffer, fileName: file.name, kind });
    const sheet = workbook.sheets.find((item) => item.index === sheetIndex);
    if (!sheet) return NextResponse.json({ ok: false, error: "ورقة العمل غير موجودة في الملف." }, { status: 422 });

    for (const [key, column] of Object.entries(input.mapping)) {
      if (column !== null && (column < 0 || column >= sheet.headers.length)) {
        return NextResponse.json(
          { ok: false, error: `العمود المحدد للحقل ${key} غير موجود في ورقة العمل.` },
          { status: 400 },
        );
      }
    }

    const validation = validateRows({ rows: sheet.rows, schema, mapping: input.mapping });
    const plan = buildImportPlan({ dataset, rows: validation.rows, issues: validation.issues });

    const blocking = plan.issues.filter((issue) => issue.level === "error");
    if (blocking.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "لا يمكن الاستيراد لوجود أخطاء يجب تصحيحها أولاً.",
          issues: blocking.slice(0, 25),
          summary: plan.summary,
        },
        { status: 422 },
      );
    }

    const importedCount =
      dataset === "trial_balance"
        ? plan.accounts.length
        : plan.entries.length > 0
          ? plan.entries.length
          : plan.records.length;

    const warnings = [...workbook.warnings, ...plan.warnings];
    const errorCount = plan.issues.filter((issue) => issue.level === "error").length;
    const warningCount = plan.issues.filter((issue) => issue.level === "warning").length + warnings.length;

    const result = await repo.saveImport(input.companyId, user.id, {
      batch: {
        fileName: file.name,
        fileKind: kind,
        sizeBytes: buffer.length,
        checksum,
        dataset,
        sheetName: sheet.name,
        mapping: input.mapping,
        rowCount: sheet.rows.length,
        importedCount,
        skippedCount: 0,
        errorCount,
        warningCount,
        status: warningCount > 0 ? "partial" : "completed",
        issues: plan.issues.slice(0, 500),
        warnings: warnings.slice(0, 100),
      },
      accounts: plan.accounts,
      entries: plan.entries,
      records: plan.records,
    });

    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      batchId: result.batch.id,
      skipped: result.skipped,
      summary: plan.summary,
      warnings,
      importedCount,
      message: result.duplicate
        ? "هذا الملف سبق استيراده بنفس المحتوى. لم تُضف بيانات جديدة."
        : "تم استيراد البيانات بنجاح.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر استيراد الملف.";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
