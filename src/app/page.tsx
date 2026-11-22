import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  FileText,
  Scale,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isAiConfigured, dataMode } from "@/lib/supabase/config";

const FEATURES = [
  {
    icon: BookOpen,
    title: "محرك محاسبي دقيق",
    description: "قيود مزدوجة، ميزان مراجعة، أرصدة افتتاحية وختامية، وقوائم مالية محسوبة بدقة عشرية دون أخطاء تقريب.",
  },
  {
    icon: FileSpreadsheet,
    title: "استيراد ذكي للملفات",
    description: "ارفع Excel أو CSV أو PDF، واكتشف الأعمدة تلقائياً، راجع المعاينة، ثم استورد بتحقق كامل وسجل مصدر.",
  },
  {
    icon: FileText,
    title: "قوائم مالية احترافية",
    description: "قائمة الدخل، المركز المالي، التدفقات النقدية، والتغيرات في حقوق الملكية مع فحص معادلة الميزانية.",
  },
  {
    icon: ShieldAlert,
    title: "فحص ومراجعة مساعدة",
    description: "اكتشاف القيود غير المتوازنة، الأرصدة غير الطبيعية، الحسابات غير المصنفة، والمبالغ بدون مستندات.",
  },
  {
    icon: Copy,
    title: "كشف التكرار والاشتباه",
    description: "تحليل متعدد المعايير للفواتير والقيود المتشابهة مع درجة اشتباه واضحة، دون أي حذف تلقائي.",
  },
  {
    icon: Bot,
    title: "مساعد محاسبي ذكي",
    description: "اسأل عن الأرقام والتغيرات والمخاطر، ويجيبك المساعد من بيانات شركتك الفعلية مع ذكر المصادر.",
  },
];

const STEPS = [
  { title: "أنشئ شركتك", text: "بيانات النشاط والعملة والسنة المالية، مع فصل صارم لبيانات كل شركة." },
  { title: "ارفع ملفاتك", text: "ميزان مراجعة، دفتر أستاذ، قيود، مبيعات، مشتريات، مصروفات، أو كشف بنك." },
  { title: "راجع النتائج", text: "قوائم مالية، نسب، رسوم، أخطاء مكتشفة، وقيود مكررة محتملة." },
  { title: "شارك التقرير", text: "تقرير عربي احترافي قابل للطباعة والتصدير إلى Excel." },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  const mode = dataMode();
  const aiReady = isAiConfigured();

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-brand-950/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/20 text-teal-200 ring-1 ring-teal-400/30">
              <Scale className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-white">ميزان</p>
              <p className="text-[9px] tracking-[0.2em] text-teal-200/80">MIZAN AI</p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            {user ? (
              <Link
                href="/dashboard"
                className="rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-white hover:bg-teal-600"
              >
                الدخول إلى المنصة
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-xl px-3 py-2 text-xs font-semibold text-white/80 hover:text-white">
                  تسجيل الدخول
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-white hover:bg-teal-600"
                >
                  إنشاء حساب
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="brand-gradient relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/10 px-3 py-1 text-[11px] font-semibold text-teal-100">
              <CheckCircle2 className="h-3.5 w-3.5" />
              منصة تحليل محاسبي عربية — تعمل ببياناتك
            </span>
            <h1 className="mt-5 text-3xl font-bold leading-[1.25] text-white sm:text-4xl lg:text-5xl">
              ميزان الذكية
              <span className="mt-2 block text-2xl font-semibold text-teal-200 sm:text-3xl">
                من الأرقام إلى قرار مالي واضح
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-8 text-white/75 sm:text-base">
              ارفع ملفاتك المحاسبية، واحصل على قوائم مالية دقيقة، تحليل مالي، كشف للأخطاء والقيود المكررة، وتقرير
              عربي احترافي — دون أن تترك بياناتك شركتك.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={user ? "/dashboard" : "/register"}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-brand-900 shadow-float hover:bg-teal-50"
              >
                ابدأ الآن
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                تجربة الحساب التجريبي
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-[10px] text-white/60">
              <span className="rounded-full bg-white/10 px-2.5 py-1">وضع التشغيل: {mode === "demo" ? "تجريبي" : "Supabase"}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">
                المساعد الذكي: {aiReady ? "متصل بمزود AI" : "إجابات محسوبة محلياً"}
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">دعم RTL كامل</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/95 p-5 shadow-float">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">نموذج قائمة الدخل</p>
                <p className="text-sm font-bold text-ink">شركة النخيل للتجارة — 2025</p>
              </div>
              <span className="rounded-full bg-success-50 px-2.5 py-1 text-[10px] font-bold text-success-600">
                بيانات تجريبية
              </span>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "صافي الإيرادات", value: "2,135,480.00", tone: "text-ink" },
                { label: "تكلفة المبيعات", value: "(1,174,514.00)", tone: "text-muted" },
                { label: "مجمل الربح", value: "960,966.00", tone: "text-ink font-bold" },
                { label: "المصروفات التشغيلية", value: "(842,110.00)", tone: "text-muted" },
                { label: "صافي الربح", value: "78,320.00", tone: "text-success-600 font-bold" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-xl bg-surface px-3 py-2.5">
                  <span className="text-xs text-ink">{row.label}</span>
                  <span dir="ltr" className={`num text-xs ${row.tone}`}>
                    {row.value} <span className="text-[10px] text-muted">ر.س</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-teal-800">
                <TrendingUp className="h-3.5 w-3.5" />
                ملاحظة تحليلية
              </p>
              <p className="mt-1 text-[11px] leading-6 text-teal-900/80">
                ارتفاع مصروف التسويق في سبتمبر بنسبة 240% عن المتوسط الشهري. يُنصح بمراجعة مستندات الحملة.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">ما تقدمه المنصة</p>
          <h2 className="mt-2 text-2xl font-bold text-brand-950">منظومة متكاملة للمحاسب والمدير والمراجع</h2>
          <p className="mt-2 text-sm leading-7 text-muted">
            لا واجهات شكلية: كل رقم في المنصة يأتي من محرك حسابي قابل للاختبار، وكل ملف مستورد يمكن تتبع مصدره.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-2xl border border-line bg-white p-5 card-shadow">
                <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="text-sm font-bold text-ink">{feature.title}</h3>
                <p className="mt-1.5 text-xs leading-6 text-muted">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 lg:px-8">
          <h2 className="text-2xl font-bold text-brand-950">أربع خطوات فقط</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {STEPS.map((step, index) => (
              <div key={step.title} className="relative rounded-2xl border border-line bg-surface/60 p-5">
                <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-800 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="text-sm font-bold text-ink">{step.title}</h3>
                <p className="mt-1 text-xs leading-6 text-muted">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 lg:px-8">
        <div className="grid gap-6 rounded-3xl border border-line bg-white p-6 card-shadow lg:grid-cols-2 lg:p-8">
          <div>
            <h2 className="text-xl font-bold text-brand-950">جرّب المنصة الآن</h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              في وضع التشغيل التجريبي تُحمَّل ثلاث شركات ببيانات وهمية واقعية، إحداها تحتوي أخطاء مقصودة لتجربة وحدة
              الفحص. لا تُستخدم أي بيانات عملاء حقيقية.
            </p>
            <div className="mt-5 space-y-2 rounded-2xl bg-surface p-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">البريد</span>
                <code dir="ltr" className="rounded bg-white px-2 py-1 font-mono text-[11px] text-brand-900">
                  demo@mizan.ai
                </code>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">كلمة المرور</span>
                <code dir="ltr" className="rounded bg-white px-2 py-1 font-mono text-[11px] text-brand-900">
                  Demo1234!
                </code>
              </div>
            </div>
            <Link
              href="/login"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-900"
            >
              تسجيل الدخول التجريبي
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-2xl border border-warning-100 bg-warning-50 p-5">
            <h3 className="text-sm font-bold text-warning-600">حدود مهمة يجب معرفتها</h3>
            <ul className="mt-2 space-y-2 text-xs leading-6 text-ink/80">
              <li>• المنصة أداة تحليل ومراجعة مساعدة، وليست رأياً قانونياً أو تقرير مراجعة معتمداً.</li>
              <li>• نتائج الاشتباه في التكرار أو الشذوذ مؤشرات للمراجعة، وليست إثباتاً لخطأ أو احتيال.</li>
              <li>• دقة القوائم تعتمد على اكتمال البيانات المستوردة وتصنيف الحسابات.</li>
              <li>• استخراج PDF تقديري، وقد يحتاج الملفات الممسوحة إلى OCR ومراجعة يدوية.</li>
              <li>• لا يقوم النظام بحذف أو تعديل أي قيد محاسبي تلقائياً.</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-center text-[11px] text-muted sm:flex-row lg:px-8">
          <p>© {new Date().getFullYear()} Mizan AI — منصة ميزان الذكية للتحليل المحاسبي والمالي.</p>
          <p>بُني بـ Next.js وTypeScript وSupabase — واجهة عربية RTL.</p>
        </div>
      </footer>
    </div>
  );
}
