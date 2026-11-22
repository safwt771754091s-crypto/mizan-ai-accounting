import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { CompanyForm } from "@/components/app/company-form";

export const metadata: Metadata = { title: "إنشاء شركة" };

export default async function NewCompanyPage() {
  await requireUser("/companies/new");

  return (
    <>
      <PageHeader
        eyebrow="إدارة الشركات"
        title="إنشاء شركة جديدة"
        description="بيانات الشركة تُستخدم في فصل الحسابات والقوائم المالية وتحديد الفترة المالية والعملة."
      />

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>بيانات الشركة</CardTitle>
              <CardDescription>الحقول المعلّمة بـ * إلزامية. يمكن تعديل الباقي لاحقاً من صفحة الشركة.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CompanyForm />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-teal-700" />
                ماذا يحدث بعد الإنشاء؟
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs leading-6 text-muted">
              <p>• يُنشأ دليل حسابات افتراضي قابل للتعديل والإضافة.</p>
              <p>• تُنشأ فترة مالية للسنة المحددة.</p>
              <p>• تُضاف أنت كمالك للشركة بصلاحيات كاملة.</p>
              <p>• يمكنك رفع ميزان المراجعة أو القيود أو المبيعات مباشرة.</p>
            </CardContent>
          </Card>
          <Alert variant="info" title="فصل البيانات">
            كل استعلام في المنصة مقيّد بمعرّف الشركة وصلاحيات عضويتك. لا يمكن الوصول إلى بيانات شركة أخرى عبر الواجهة
            أو واجهات API.
          </Alert>
        </div>
      </div>
    </>
  );
}
