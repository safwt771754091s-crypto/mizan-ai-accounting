import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FileSpreadsheet,
  FileText,
  Layers,
  Lock,
  Scale,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isAiConfigured, dataMode } from "@/lib/supabase/config";
import { buildDemoCompanies, buildDemoData } from "@/lib/data/demo-data";
import { buildBalanceSheet, buildIncomeStatement } from "@/lib/accounting/statements";
import { buildFinancialAnalysis } from "@/lib/accounting/ratios";
import { detectAuditFindings } from "@/lib/accounting/findings";
import { detectDuplicates } from "@/lib/accounting/duplicates";
import { detectAnomalies } from "@/lib/accounting/anomalies";

const CURRENCY_LABEL: Record<string, string> = { SAR: "ر.س", AED: "د.إ", USD: "$" };

function fmt(value: number): string {
  const text = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value < 0 ? `(${text})` : text;
}

function pct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

const CAPABILITIES = [
  {
    icon: FileSpreadsheet,
    title: "تحليل البيانات المالية",
    description: "استيراد منظم لملفات Excel وCSV وPDF مع ربط الأعمدة يدوياً أو تلقائياً قبل الحفظ.",
    points: ["اكتشاف الأعمدة ومعاينة الصفوف", "تحقق من الصيغ والتواريخ والمبالغ", "سجل مصدر لكل صف مستورد"],
  },
  {
    icon: FileText,
    title: "إعداد القوائم المالية",
    description: "قوائم مترابطة تُبنى من القيود المرحّلة، لا من أرقام مكتوبة يدوياً في الواجهة.",
    points: ["دخل ومركز مالي وتدفقات نقدية", "ميزان مراجعة بالمجاميع والأرصدة", "دفتر أستاذ بحسب الحساب"],
  },
  {
    icon: ShieldAlert,
    title: "اكتشاف الأخطاء المحاسبية",
    description: "فحص آلي للقيود والأرصدة يكشف الحالات التي تحتاج مراجعة بشرية قبل إقفال الفترة.",
    points: ["قيود غير متوازنة وحسابات غير مصنفة", "أرصدة مخالفة للطبيعة المدينة/الدائنة", "تواريخ خارج الفترة المالية"],
  },
  {
    icon: Copy,
    title: "كشف القيود والفواتير المكررة",
    description: "مقارنة متعددة المعايير بين المبلغ والتاريخ والطرف والوصف، بدرجات اشتباه واضحة.",
    points: ["اشتباه قوي ومتوسط وضعيف", "تكرار رقم الفاتورة أو المورد", "لا حذف ولا تعديل تلقائي"],
  },
  {
    icon: TrendingUp,
    title: "التحليل المالي والمؤشرات",
    description: "نسب معلنة المعادلات، ومقارنة بين الفترات، مع امتناع صريح عن أي نسبة لا تكتمل بياناتها.",
    points: ["سيولة وربحية ومديونية ودوران", "اتجاهات شهرية ورسوم من البيانات الفعلية", "توضيح المعادلة وحدودها"],
  },
  {
    icon: Bot,
    title: "المساعد المحاسبي الذكي",
    description: "يجيب من نتائج المحرك داخل نطاق الشركة المحددة وصلاحيات المستخدم فقط.",
    points: ["أرقام محسوبة لا مُختلَقة", "ذكر المصدر وطريقة التحليل", "لا تعديل للقيود دون صلاحية"],
  },
];

const STEPS = [
  { icon: Building2, title: "أنشئ شركتك", text: "النشاط والعملة والسنة المالية، ثم ادعُ فريقك بأدوار محددة." },
  { icon: Upload, title: "ارفع ملفاتك", text: "ميزان مراجعة، دفتر أستاذ، قيود، مبيعات، مشتريات، مصروفات، أو كشف بنك." },
  { icon: ClipboardCheck, title: "راجع قبل الحفظ", text: "معاينة، اكتشاف أعمدة، تحقق من الأخطاء، ثم تأكيد الاستيراد." },
  { icon: FileText, title: "اقرأ النتائج", text: "قوائم ونسب وملاحظات وتقرير عربي قابل للطباعة والتصدير." },
];

const GUARANTEES = [
  { icon: Lock, title: "عزل صارم للبيانات", text: "كل استعلام مقيّد بالشركة التي ينتمي إليها المستخدم، وسياسات RLS في وضع Supabase." },
  { icon: Layers, title: "أرقام قابلة للتتبع", text: "كل رقم في القوائم يعود إلى قيود مرحّلة وملف مصدر، ويمكن تتبعه خطوة بخطوة." },
  { icon: BadgeCheck, title: "دقة عشرية", text: "الحسابات تُجرى بـ Decimal لا بأرقام عائمة، مع تسوية صريحة عند وجود فرق." },
  { icon: ShieldAlert, title: "لا تعديل تلقائي", text: "المنصة تكشف وتنبّه وتقترح، ولا تحذف قيداً ولا تعتمد قائمة مالية بدلاً منك." },
];

const FAQ = [
  {
    q: "هل الأرقام المعروضة على هذه الصفحة حقيقية؟",
    a: "لا. الأرقام في المعاينة محسوبة الآن من محرك ركاز على بيانات تجريبية لشركة «النخيل للتجارة»، وهدفها إظهار شكل المخرجات ودقتها الحسابية. بياناتك أنت لا تُستخدم في أي عرض عام.",
  },
  {
    q: "هل أحتاج Supabase لتجربة المنصة؟",
    a: "لا. يوجد وضع تجريبي كامل يعمل محلياً ببيانات وهمية دون أي خدمة خارجية. وضع Supabase مطلوب للإنتاج متعدد المستخدمين، وترحيلاته جاهزة في المستودع.",
  },
  {
    q: "هل يستبدل المساعد الذكي المحاسب القانوني؟",
    a: "لا. المساعد والقوائم أدوات تحليل مساعدة، ولا تُعد رأياً قانونياً أو تقرير مراجعة معتمداً. القرار النهائي ومسؤوليته للمحاسب المرخّص.",
  },
  {
    q: "من أين يأتي رقم صافي الربح في المساعد؟",
    a: "من نفس دوال المحرك التي تبني قائمة الدخل، لا من نص يكتبه النموذج اللغوي. عند عدم وجود مزود AI يعمل المساعد بقواعد محلية فوق النتائج المحسوبة.",
  },
  {
    q: "هل تحذف المنصة القيود المكررة؟",
    a: "لا. تُعرض القيود المتشابهة بدرجة اشتباه وأسباب، ويبقى القرار للمستخدم. لا يوجد أي حذف أو تعديل تلقائي لأي قيد.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  const mode = dataMode();
  const aiReady = isAiConfigured();

  const company = buildDemoCompanies().find((item) => item.id === "co-nakheel")!;
  const demoData = buildDemoData()[company.id];
  const ledger = { accounts: demoData.accounts, entries: demoData.entries, currency: company.currency };
  const period = { from: "2025-01-01", to: "2025-12-31" };
  const income = buildIncomeStatement(ledger, period);
  const balance = buildBalanceSheet(ledger, { ...period, periodStart: period.from });
  const analysis = buildFinancialAnalysis(ledger, period);
  const findings = detectAuditFindings(ledger, period);
  const duplicates = detectDuplicates(ledger, period);
  const anomalies = detectAnomalies(ledger, period);
  const ratio = (key: string) => analysis.ratios.find((item) => item.key === key)?.value ?? null;
  const currency = CURRENCY_LABEL[company.currency] ?? company.currency;

  const incomeRows = [
    { label: "صافي الإيرادات", value: income.netRevenue, strong: false },
    { label: "تكلفة المبيعات", value: -income.costOfSales, strong: false },
    { label: "مجمل الربح", value: income.grossProfit, strong: true },
    { label: "المصروفات التشغيلية", value: -income.operatingExpenses, strong: false },
    { label: "صافي الربح", value: income.netProfit, strong: true, tone: "text-success-600" },
  ];

  const balanceRows = [
    { label: "إجمالي الأصول", value: balance.totalAssets },
    { label: "إجمالي الالتزامات", value: balance.totalLiabilities },
    { label: "حقوق الملكية", value: balance.totalEquity },
  ];

  const topAnomaly = anomalies[0];
  const spikeReason = topAnomaly?.reasons.find((reason) => reason.includes("%")) ?? topAnomaly?.description ?? "";

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-brand-950/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/20 text-teal-200 ring-1 ring-teal-400/30">
              <Scale className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold text-white">ركاز</span>
              <span className="block text-[9px] tracking-[0.2em] text-teal-200/80">RAKAZ AI</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="روابط الصفحة">
            {[
              { href: "#capabilities", label: "الإمكانات" },
              { href: "#statements", label: "القوائم" },
              { href: "#how", label: "كيف يعمل" },
              { href: "#faq", label: "الأسئلة" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-teal-600 sm:px-4"
              >
                لوحة التحكم
                <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden rounded-xl px-3 py-2 text-xs font-semibold text-white/80 transition hover:text-white sm:block"
                >
                  تسجيل الدخول
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-teal-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-teal-600 sm:px-4"
                >
                  ابدأ مجاناً
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="brand-gradient relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden>
          <div className="absolute -top-24 start-1/4 h-72 w-72 rounded-full bg-white blur-3xl" />
          <div className="absolute -bottom-32 end-0 h-80 w-80 rounded-full bg-teal-300 blur-3xl" />
        </div>
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:px-8 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/10 px-3 py-1 text-[11px] font-semibold text-teal-100">
              <Sparkles className="h-3.5 w-3.5" />
              ركاز — منصة الذكاء المحاسبي والمالي
            </span>
            <h1 className="mt-5 text-[28px] font-bold leading-[1.3] text-white sm:text-4xl lg:text-[42px]">
              ركاز
              <span className="mt-2 block text-xl font-semibold text-teal-200 sm:text-2xl lg:text-3xl">
                من الأرقام إلى قرار مالي واضح
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-8 text-white/75 sm:text-base">
              ارفع ملفاتك المحاسبية، واحصل على قوائم مالية محسوبة بدقة، وتحليل مالي، وكشف للأخطاء والقيود المكررة،
              وتقرير عربي احترافي — دون أن تترك بياناتك شركتك.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={user ? "/dashboard" : "/register"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-brand-900 shadow-float transition hover:bg-teal-50 sm:w-auto"
              >
                ابدأ الآن
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
              >
                تجربة الحساب التجريبي
              </Link>
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-white/65">
              {["دقة عشرية بلا أخطاء تقريب", "عزل بيانات كل شركة", "واجهة عربية RTL", "تصدير Excel وطباعة PDF"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-300" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white p-4 shadow-float sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">معاينة قائمة الدخل</p>
                <p className="mt-0.5 text-sm font-bold text-ink">{company.name} — 2025</p>
              </div>
              <span className="rounded-full bg-warning-50 px-2.5 py-1 text-[10px] font-bold text-warning-600">
                بيانات تجريبية
              </span>
            </div>

            <div className="mt-4 space-y-1.5">
              {incomeRows.map((row) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
                    row.strong ? "bg-surface" : ""
                  }`}
                >
                  <span className={`text-[11px] sm:text-xs ${row.strong ? "font-bold text-ink" : "text-muted"}`}>
                    {row.label}
                  </span>
                  <span
                    dir="ltr"
                    className={`num whitespace-nowrap text-[11px] sm:text-xs ${row.tone ?? "text-ink"} ${
                      row.strong ? "font-bold" : ""
                    }`}
                  >
                    {fmt(row.value)} <span className="text-[10px] font-normal text-muted">{currency}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: "هامش مجمل", value: pct(ratio("gross_margin")) },
                { label: "هامش صافي", value: pct(ratio("net_margin")) },
                { label: "نسبة التداول", value: ratio("current_ratio")?.toFixed(2) ?? "—" },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-xl border border-line bg-surface/70 px-2 py-2 text-center">
                  <p className="text-[9px] text-muted">{kpi.label}</p>
                  <p dir="ltr" className="num mt-0.5 text-xs font-bold text-brand-800">
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50 p-3">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" />
              <p className="text-[10px] leading-5 text-teal-900/85">
                {topAnomaly ? (
                  <>
                    <span className="font-bold">{topAnomaly.title}:</span> {spikeReason}
                  </>
                ) : (
                  "لا توجد انحرافات بارزة في الفترة المختارة."
                )}
              </p>
            </div>

            <p className="mt-3 text-center text-[9px] leading-5 text-muted">
              محسوبة من محرك ركاز على بيانات تجريبية — ليست بيانات عميل حقيقي.
            </p>
          </div>
        </div>
      </section>

      <section id="capabilities" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">الإمكانات</p>
            <h2 className="mt-2 text-2xl font-bold text-brand-950 sm:text-3xl">منظومة واحدة للمحاسب والمدير والمراجع</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              كل رقم في ركاز يأتي من محرك حسابي قابل للاختبار، وكل ملف مستورد يمكن تتبع مصدره. لا واجهات شكلية ولا
              نتائج مُقدَّرة.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="flex flex-col rounded-2xl border border-line bg-white p-5 card-shadow">
                  <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-sm font-bold text-ink">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-6 text-muted">{item.description}</p>
                  <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                    {item.points.map((point) => (
                      <li key={point} className="flex items-start gap-1.5 text-[11px] leading-5 text-ink/75">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-teal-600" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="statements" className="scroll-mt-20 border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">المخرجات</p>
              <h2 className="mt-2 text-2xl font-bold text-brand-950 sm:text-3xl">قوائم مترابطة، لا أرقام منفصلة</h2>
              <p className="mt-3 text-sm leading-7 text-muted">
                القوائم تُبنى من نفس القيود المرحّلة، فيجب أن يتطابق صافي الربح في قائمة الدخل مع التغير في حقوق
                الملكية، وأن تتحقق معادلة المركز المالي.
              </p>
            </div>
            <span className="rounded-full bg-warning-50 px-3 py-1.5 text-[10px] font-bold text-warning-600">
              عرض توضيحي — بيانات تجريبية
            </span>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-line bg-surface/50 p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <FileText className="h-4 w-4 text-teal-700" />
                  قائمة الدخل
                </h3>
                <span className="text-[10px] text-muted">2025 · {currency}</span>
              </div>
              <dl className="mt-4 space-y-1.5">
                {incomeRows.map((row) => (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
                      row.strong ? "bg-white font-bold" : "bg-white/60"
                    }`}
                  >
                    <dt className={`text-[11px] ${row.strong ? "text-ink" : "text-muted"}`}>{row.label}</dt>
                    <dd dir="ltr" className={`num whitespace-nowrap text-[11px] ${row.tone ?? "text-ink"}`}>
                      {fmt(row.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>

            <article className="rounded-2xl border border-line bg-surface/50 p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Scale className="h-4 w-4 text-teal-700" />
                  المركز المالي
                </h3>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    balance.balanced ? "bg-success-50 text-success-600" : "bg-danger-50 text-danger-600"
                  }`}
                >
                  {balance.balanced ? "المعادلة متوازنة" : `فرق ${fmt(balance.difference)}`}
                </span>
              </div>
              <dl className="mt-4 space-y-1.5">
                {balanceRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg bg-white/60 px-3 py-2">
                    <dt className="text-[11px] text-muted">{row.label}</dt>
                    <dd dir="ltr" className="num whitespace-nowrap text-[11px] text-ink">
                      {fmt(row.value)}
                    </dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                  <dt className="text-[11px] font-bold text-ink">الأصول − (الالتزامات + الحقوق)</dt>
                  <dd
                    dir="ltr"
                    className={`num whitespace-nowrap text-[11px] font-bold ${
                      balance.balanced ? "text-success-600" : "text-danger-600"
                    }`}
                  >
                    {fmt(balance.difference)}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-[10px] leading-5 text-teal-900/85">
                يُتحقق من المعادلة بعد كل ترحيل، وأي فرق يظهر كتنبيه في القوائم والتقرير.
              </p>
            </article>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              { label: "ملاحظات فحص في الشركة التجريبية", value: findings.length.toString() },
              { label: "اشتباه تكرار محتمل", value: duplicates.length.toString() },
              { label: "انحرافات مصروفات للمراجعة", value: anomalies.length.toString() },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-line bg-surface/60 px-4 py-3">
                <p dir="ltr" className="num text-lg font-bold text-brand-800">
                  {item.value}
                </p>
                <p className="mt-0.5 text-[10px] leading-5 text-muted">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-5 text-muted">
            الأرقام أعلاه محسوبة الآن من محرك ركاز على بيانات تجريبية، وتُظهر حجم المخرجات لا نتائج عميل حقيقي.
          </p>
        </div>
      </section>

      <section id="how" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">كيف يعمل</p>
            <h2 className="mt-2 text-2xl font-bold text-brand-950 sm:text-3xl">من الملف إلى التقرير في أربع خطوات</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative rounded-2xl border border-line bg-white p-5 card-shadow">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-800 text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="num text-xs font-bold text-brand-200">0{index + 1}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-ink">{step.title}</h3>
                  <p className="mt-1 text-xs leading-6 text-muted">{step.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">الثقة والحوكمة</p>
              <h2 className="mt-2 text-2xl font-bold text-brand-950 sm:text-3xl">مصمّمة لبيانات محاسبية حساسة</h2>
              <p className="mt-3 text-sm leading-7 text-muted">
                الفصل بين الشركات ليس خياراً في الواجهة، بل قيد في طبقة البيانات نفسها. والصلاحيات تحدد من يرى ومن
                يعدّل ومن يدعو أعضاء جدد.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-[10px] text-brand-800">
                <span className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1">Supabase RLS</span>
                <span className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1">
                  أدوار: مالك، مدير، محاسب، مراجع، مشاهد
                </span>
                <span className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1">سجل عمليات</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {GUARANTEES.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-line bg-surface/60 p-4">
                    <Icon className="h-4 w-4 text-teal-700" />
                    <h3 className="mt-2 text-xs font-bold text-ink">{item.title}</h3>
                    <p className="mt-1 text-[11px] leading-5 text-muted">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16 lg:px-8">
        <div className="grid gap-6 rounded-3xl border border-line bg-white p-5 card-shadow sm:p-7 lg:grid-cols-2 lg:p-8">
          <div>
            <h2 className="text-xl font-bold text-brand-950 sm:text-2xl">جرّب المنصة الآن</h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              في وضع التشغيل التجريبي تُحمَّل ثلاث شركات ببيانات وهمية واقعية، إحداها تحتوي أخطاء مقصودة لتجربة وحدة
              الفحص. لا تُستخدم أي بيانات عملاء حقيقية.
            </p>
            <div className="mt-5 space-y-2 rounded-2xl bg-surface p-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">البريد</span>
                <code dir="ltr" className="rounded bg-white px-2 py-1 font-mono text-[11px] text-brand-900">
                  demo@rakaz.ai
                </code>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">كلمة المرور</span>
                <code dir="ltr" className="rounded bg-white px-2 py-1 font-mono text-[11px] text-brand-900">
                  Demo1234!
                </code>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">وضع التشغيل</span>
                <span className="rounded bg-white px-2 py-1 text-[11px] text-brand-900">
                  {mode === "demo" ? "تجريبي محلي" : "Supabase"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">المساعد</span>
                <span className="rounded bg-white px-2 py-1 text-[11px] text-brand-900">
                  {aiReady ? "مزود AI متصل" : "إجابات محسوبة محلياً"}
                </span>
              </div>
            </div>
            <Link
              href="/login"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-900"
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
              <li>• استخراج PDF نصي؛ الملفات الممسوحة تحتاج OCR ومراجعة يدوية.</li>
              <li>• لا يقوم النظام بحذف أو تعديل أي قيد محاسبي تلقائياً.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-20 border-t border-line bg-white">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:py-16 lg:px-8">
          <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">الأسئلة الشائعة</p>
          <h2 className="mt-2 text-2xl font-bold text-brand-950 sm:text-3xl">قبل أن تبدأ</h2>
          <div className="mt-6 divide-y divide-line rounded-2xl border border-line">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-4 py-3 open:bg-surface/50">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold text-ink marker:hidden">
                  {item.q}
                  <span className="text-teal-700 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-[11px] leading-6 text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="brand-gradient">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-12 text-center sm:py-14">
          <BookOpen className="h-6 w-6 text-teal-200" />
          <h2 className="text-xl font-bold text-white sm:text-2xl">جاهز لترى أرقامك بوضوح؟</h2>
          <p className="max-w-xl text-xs leading-6 text-white/70 sm:text-sm">
            أنشئ حسابك، أضف شركتك الأولى، وارفع ملفك المحاسبي الأول — النتائج تظهر خلال دقائق.
          </p>
          <div className="mt-1 flex flex-col gap-3 sm:flex-row">
            <Link
              href={user ? "/dashboard" : "/register"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-brand-900 transition hover:bg-teal-50 sm:w-auto"
            >
              إنشاء حساب
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
            >
              الدخول إلى حسابي
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-800 text-white">
                <Scale className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-brand-950">ركاز | RAKAZ AI</span>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-muted">
              <a href="#capabilities" className="hover:text-brand-800">
                الإمكانات
              </a>
              <a href="#statements" className="hover:text-brand-800">
                القوائم
              </a>
              <a href="#how" className="hover:text-brand-800">
                كيف يعمل
              </a>
              <a href="#faq" className="hover:text-brand-800">
                الأسئلة
              </a>
              <Link href="/login" className="hover:text-brand-800">
                الدخول
              </Link>
            </nav>
          </div>
          <div className="mt-5 flex flex-col items-center justify-between gap-2 border-t border-line pt-4 text-center text-[10px] text-muted sm:flex-row sm:text-start">
            <p>© {new Date().getFullYear()} ركاز | RAKAZ AI — منصة الذكاء المحاسبي والمالي.</p>
            <p>تحليل مساعد لا يُعد رأياً قانونياً أو تقرير مراجعة معتمداً.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
