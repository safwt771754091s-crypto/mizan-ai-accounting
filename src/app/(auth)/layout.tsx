import Link from "next/link";
import { CheckCircle2, Scale, ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-16">
        <Link href="/" className="mb-8 inline-flex w-fit items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-800 text-white">
            <Scale className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-base font-bold text-brand-950">ميزان</span>
            <span className="block text-[9px] tracking-[0.2em] text-teal-700">MIZAN AI</span>
          </span>
        </Link>
        <div className="w-full max-w-md">{children}</div>
        <p className="mt-10 max-w-md text-[10px] leading-5 text-muted">
          بالدخول أنت توافق على أن المنصة أداة تحليل مساعدة، وأن القرارات المالية النهائية مسؤولية المستخدم.
        </p>
      </div>

      <div className="brand-gradient relative hidden flex-col justify-between p-12 lg:flex">
        <div className="max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/10 px-3 py-1 text-[11px] font-semibold text-teal-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            بياناتك معزولة لكل شركة
          </span>
          <h2 className="mt-6 text-3xl font-bold leading-snug text-white">
            كل ما يحتاجه المحاسب
            <span className="block text-teal-200">في مكان واحد واضح</span>
          </h2>
          <p className="mt-4 text-sm leading-8 text-white/70">
            من رفع ميزان المراجعة إلى تقرير مالي عربي جاهز للطباعة — بحسابات دقيقة وقابلية تتبع كاملة لكل رقم.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "محرك محاسبي دقيق باستخدام Decimal",
              "قوائم مالية وتدفقات نقدية وتحليل نسب",
              "اكتشاف الأخطاء والقيود المكررة والمخاطر",
              "مساعد ذكي يجيب من بيانات شركتك فقط",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-white/85">
                <CheckCircle2 className="h-4 w-4 text-teal-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-xs leading-7 text-white/70">
          <p className="font-bold text-white">تنبيه مهني</p>
          <p className="mt-1">
            التقارير والنتائج التي تنتجها المنصة هي تحليل مساعد ولا تُعد رأياً قانونياً مستقلاً أو تقرير مراجعة
            معتمداً وفق المعايير المهنية.
          </p>
        </div>
      </div>
    </div>
  );
}
