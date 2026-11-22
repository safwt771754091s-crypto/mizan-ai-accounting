import type { Metadata } from "next";
import { ShieldCheck, Upload } from "lucide-react";
import { loadCompanyContext } from "@/lib/data/context";
import { ImportWizard } from "@/components/app/import-wizard";
import { AccessDenied, NoCompanyState } from "@/components/app/blocks";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "رفع الملفات" };

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="رفع الملفات" description="استيراد الملفات المحاسبية." />
        <NoCompanyState />
      </>
    );
  }

  if (!ctx.allows("imports.create")) {
    return (
      <>
        <PageHeader eyebrow={ctx.company.name} title="رفع الملفات" />
        <AccessDenied description="رفع الملفات واستيرادها يتطلب صلاحية «استيراد ملفات»." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={ctx.company.name}
        title="رفع واستيراد الملفات المحاسبية"
        description="ارفع ميزان المراجعة أو دفتر الأستاذ أو القيود أو المبيعات. يتم اكتشاف الأعمدة تلقائياً، ويمكنك مراجعة البيانات قبل الحفظ."
      />

      <ImportWizard companyId={ctx.company.id} currency={ctx.currency} />

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4">
          <Upload className="mb-2 h-4 w-4 text-teal-700" />
          <p className="text-xs font-bold text-ink">الصيغ المدعومة</p>
          <p className="mt-1 text-[11px] leading-6 text-muted">
            XLSX وXLS (النصي) وCSV وPDF. صيغة XLS الثنائية القديمة تحتاج تحويلاً إلى XLSX. ملفات PDF الممسوحة تحتاج OCR ومراجعة يدوية.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <ShieldCheck className="mb-2 h-4 w-4 text-teal-700" />
          <p className="text-xs font-bold text-ink">حماية الملفات</p>
          <p className="mt-1 text-[11px] leading-6 text-muted">
            تحقق من الامتداد والتوقيع الفعلي والحجم، ومنع الملفات التنفيذية، وحساب بصمة SHA-256 لمنع الاستيراد المكرر.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <ShieldCheck className="mb-2 h-4 w-4 text-teal-700" />
          <p className="text-xs font-bold text-ink">تتبع المصدر</p>
          <p className="mt-1 text-[11px] leading-6 text-muted">
            كل سجل مستورد مرتبط بالملف والورقة والصف وعملية الاستيراد، ويمكن مراجعته لاحقاً من صفحة بيانات المحاسبة المستوردة.
          </p>
        </div>
      </div>
    </>
  );
}
