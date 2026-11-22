import type { Metadata } from "next";
import { Bot, Database, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { loadCompanyContext } from "@/lib/data/context";
import { dataMode, isAiConfigured, isSupabaseConfigured, aiModel } from "@/lib/supabase/config";
import { CompanyForm } from "@/components/app/company-form";
import { ResetDemoForm } from "@/components/app/reset-demo-form";
import { NoCompanyState } from "@/components/app/blocks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "الإعدادات" };

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-1.5">
      <span className="text-[11px] text-muted">{label}</span>
      <Badge variant={ok ? "success" : "neutral"}>{ok ? "مضبوط" : "غير مضبوط"}</Badge>
    </div>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);
  const mode = dataMode();

  return (
    <>
      <PageHeader
        eyebrow="النظام"
        title="الإعدادات"
        description="بيانات الشركة، حالة التكامل مع Supabase ومزود الذكاء الاصطناعي، وإعدادات الأمان."
      />

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {ctx.company ? (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>بيانات الشركة</CardTitle>
                  <CardDescription>تُستخدم في التقارير والقوائم المالية والفترات.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <CompanyForm company={ctx.company} />
              </CardContent>
            </Card>
          ) : (
            <NoCompanyState />
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-700" />
                الأمان والخصوصية
              </CardTitle>
              <CardDescription>الضوابط المطبقة في هذه النسخة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] leading-6 text-muted">
              <p>• عزل بيانات الشركات عبر التحقق من العضوية في كل طلب، وسياسات RLS عند استخدام Supabase.</p>
              <p>• كلمات المرور تُخزّن مشفرة بـ scrypt في وضع العرض، ولا تُسجل في السجلات.</p>
              <p>• جلسات العرض موقعة HMAC ومحمية بـ HttpOnly وSameSite.</p>
              <p>• الملفات المرفوعة تُفحص امتداداً وتوقيعاً وحجماً، وتُحسب لها بصمة SHA-256 لمنع التكرار.</p>
              <p>• لا تُرسل الملفات إلى أي خدمة خارجية، ولا تُخزن في مجلدات عامة.</p>
              <p>• الأسرار تُقرأ من متغيرات البيئة فقط، وملف .env.example لا يحتوي أي مفاتيح حقيقية.</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4 text-teal-700" />
                وضع التشغيل
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-ink">الوضع الحالي</span>
                  <Badge variant={mode === "demo" ? "warning" : "success"}>
                    {mode === "demo" ? "عرض تجريبي (ملف محلي)" : "Supabase"}
                  </Badge>
                </div>
                <p className="mt-1.5 text-[10px] leading-5 text-muted">
                  {mode === "demo"
                    ? "البيانات تُخزن في ملف محلي داخل الخادم. مناسب للتجربة والتطوير، وليس للإنتاج."
                    : "البيانات والمصادقة والملفات عبر Supabase مع سياسات RLS."}
                </p>
              </div>
              <Status ok={isSupabaseConfigured()} label="NEXT_PUBLIC_SUPABASE_URL / ANON_KEY" />
              <Status ok={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)} label="SUPABASE_SERVICE_ROLE_KEY (اختياري)" />
              <Status ok={Boolean(process.env.RAKAZ_DEMO_SESSION_SECRET)} label="RAKAZ_DEMO_SESSION_SECRET" />
              <p className="text-[10px] leading-5 text-muted">
                للتبديل إلى Supabase: اضبط المتغيرات ثم شغّل المخطط من <code dir="ltr">supabase/migrations</code>.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-teal-700" />
                المساعد الذكي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Status ok={isAiConfigured()} label="AI_PROVIDER_API_KEY" />
              <div className="rounded-lg bg-surface px-2.5 py-1.5">
                <p className="text-[10px] text-muted">المزود / النموذج</p>
                <p className="text-[11px] font-semibold text-ink" dir="ltr">
                  {isAiConfigured() ? aiModel() : "local-deterministic"}
                </p>
              </div>
              <p className="text-[10px] leading-5 text-muted">
                بدون مفتاح، يجيب المساعد من محرك التحليل المحلي بأرقام فعلية. مع المفتاح، تُرسل الأرقام الملخصة فقط
                لتوليد صياغة لغوية، ولا تُرسل الملفات الخام.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-teal-700" />
                الجلسة والصلاحيات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] leading-6 text-muted">
              <p>• المالك: كل الصلاحيات بما فيها إدارة الأعضاء.</p>
              <p>• المدير: تعديل واستيراد وإدارة أعضاء.</p>
              <p>• المحاسب: تعديل واستيراد بدون إدارة أعضاء.</p>
              <p>• المراجع: قراءة ومراجعة الملاحظات بدون استيراد.</p>
              <p>• المشاهد: قراءة فقط.</p>
            </CardContent>
          </Card>

          {mode === "demo" ? (
            <Card className="border-danger-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-danger-600">
                  <KeyRound className="h-4 w-4" />
                  منطقة الخطر
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResetDemoForm enabled={ctx.user.isSuperAdmin} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <Alert variant="info" title="ملاحظة على النشر">
          في الإنتاج: استخدم Supabase مع RLS، واضبط متغيرات البيئة في منصة الاستضافة، وفعّل HTTPS، وراجع سياسات
          الاحتفاظ بالبيانات والنسخ الاحتياطي.
        </Alert>
      </div>
    </>
  );
}
