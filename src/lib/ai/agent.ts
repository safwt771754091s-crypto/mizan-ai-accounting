import { formatMoney } from "@/lib/accounting/money";
import { isAiConfigured } from "@/lib/supabase/config";
import { formatContextForPrompt, type AssistantContext } from "./context";
import { findUngroundedNumbers } from "./grounding";
import { callChatCompletion, describeProviderFailure } from "./provider";

export interface AssistantAnswer {
  answer: string;
  mode: "local" | "ai";
  sources: string[];
  fallbackReason?: string;
}

function money(context: AssistantContext, value: number): string {
  return formatMoney(value, context.company.currency);
}

function pct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "غير متاحة";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function bullets(items: string[]): string {
  return items.map((item) => `• ${item}`).join("\n");
}

function monthLabelOf(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const names = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];
  return `${names[month - 1] ?? month} ${year}`;
}

const SEVERITY_AR: Record<string, string> = {
  critical: "حرج",
  high: "مرتفع",
  medium: "متوسط",
  low: "منخفض",
  info: "معلومة",
};

export function answerLocally(question: string, context: AssistantContext): AssistantAnswer {
  const text = question.trim();
  const c = context;
  const sources = [
    "قائمة الدخل المحسوبة من القيود المرحّلة",
    "قائمة المركز المالي",
    "وحدة الفحص والتحليل",
    ...c.sources,
  ];

  if (/مكرر|تكرار|فاتورة مكررة|سند مكرر/.test(text)) {
    if (!c.duplicates.length) {
      return {
        answer: `لم تُكتشف مجموعات اشتباه بالتكرار في الفترة ${c.company.period.from} — ${c.company.period.to}.\n\nهذا لا يضمن عدم وجود تكرار؛ قد يظهر عند تغيّر المعايير أو إضافة بيانات جديدة. المصدر: وحدة كشف التكرار.`,
        mode: "local",
        sources,
      };
    }
    const relevant = c.duplicates.filter((group) => group.strength !== "weak");
    const listed = (relevant.length ? relevant : c.duplicates).slice(0, 5);
    const lines = listed.map(
      (group, index) =>
        `${index + 1}. ${group.entries.length} سجلات (${group.entries.join("، ")}) — درجة ${group.score.toFixed(
          0,
        )}/100، اشتباه ${group.strength === "strong" ? "قوي" : group.strength === "medium" ? "متوسط" : "ضعيف"}. السبب: ${group.reasons[0]}`,
    );
    return {
      answer: `وجدت ${c.duplicates.length} مجموعة اشتباه بالتكرار، منها ${relevant.length} متوسطة أو قوية:\n\n${bullets(lines)}\n\nالتوصية: ${listed[0].recommendation}\n\nملاحظة: هذه مؤشرات للمراجعة ولا تُعد إثباتاً لخطأ. لا يتم حذف أو تعديل أي قيد تلقائياً. المصدر: وحدة كشف التكرار.`,
      mode: "local",
      sources,
    };
  }

  if (/غير معتاد|شاذ|مخاطر|احتيال|مشبوه/.test(text)) {
    const risky = c.anomalies.filter((item) => item.severity === "high" || item.severity === "medium");
    if (!risky.length) {
      return {
        answer: `لم تُكتشف عمليات غير معتادة تتجاوز القواعد الحالية في الفترة ${c.company.period.from} — ${c.company.period.to}.\n\nالقواعد إحصائية وقد تحتاج تخصيصاً لطبيعة نشاطك. المصدر: وحدة تحليل الشذوذ.`,
        mode: "local",
        sources,
      };
    }
    const lines = risky.slice(0, 5).map(
      (item) => `${item.title} — ${money(c, item.amount)} (خطورة ${SEVERITY_AR[item.severity] ?? item.severity}). ${item.reasons[0] ?? ""}`,
    );
    return {
      answer: `رصدت ${risky.length} مؤشر عملية غير معتادة تحتاج مراجعة:\n\n${bullets(lines)}\n\nهذه مؤشرات تحليلية وليست دليلاً على احتيال. راجع المستندات الأصلية قبل أي استنتاج. المصدر: وحدة تحليل الشذوذ.`,
      mode: "local",
      sources,
    };
  }

  if (/سيولة|تداول|سريعة|نسبة التداول/.test(text)) {
    const current = c.ratios.find((ratio) => ratio.label.includes("التداول"));
    const quick = c.ratios.find((ratio) => ratio.label.includes("السريعة"));
    const lines = [
      current
        ? `نسبة التداول: ${current.available && current.value !== null ? current.value.toFixed(2) : "غير متاحة"} — ${current.formula}`
        : "نسبة التداول: غير متاحة.",
      quick
        ? `النسبة السريعة: ${quick.available && quick.value !== null ? quick.value.toFixed(2) : "غير متاحة"} — ${quick.formula}`
        : "النسبة السريعة: غير متاحة.",
      `الأصول المتداولة: ${money(c, c.totals.currentAssets)}`,
      `الالتزامات المتداولة: ${money(c, c.totals.currentLiabilities)}`,
      `النقدية والبنك: ${money(c, c.totals.cash + c.totals.bank)}`,
    ];
    return {
      answer: `مؤشرات السيولة كما في ${c.company.period.to}:\n\n${bullets(lines)}\n\nنسبة تداول أقل من 1 تعني أن الالتزامات المتداولة تتجاوز الأصول المتداولة. المصدر: قائمة المركز المالي والنسب المحسوبة.`,
      mode: "local",
      sources,
    };
  }

  if (/مركز\s*المالي|ميزانية|الأصول|أصول|الالتزامات|التزامات|حقوق\s*الملكية/.test(text)) {
    const lines = [
      `إجمالي الأصول: ${money(c, c.totals.totalAssets)}`,
      `الأصول المتداولة: ${money(c, c.totals.currentAssets)} (نقدية ${money(c, c.totals.cash)}، بنك ${money(c, c.totals.bank)}، عملاء ${money(c, c.totals.receivables)}، مخزون ${money(c, c.totals.inventory)})`,
      `إجمالي الالتزامات: ${money(c, c.totals.totalLiabilities)}`,
      `حقوق الملكية: ${money(c, c.totals.totalEquity)}`,
      c.trial.balanced
        ? "المعادلة المحاسبية متوازنة: الأصول = الالتزامات + حقوق الملكية."
        : `المعادلة غير متوازنة بفرق ${money(c, c.trial.difference)}؛ يلزم مراجعة القيود والأرصدة الافتتاحية.`,
    ];
    return {
      answer: `ملخص المركز المالي كما في ${c.company.period.to}:\n\n${bullets(lines)}\n\nالمصدر: قائمة المركز المالي المحسوبة من القيود المرحّلة.`,
      mode: "local",
      sources,
    };
  }

  if (/أكبر المصروفات|أكبر مصروف|توزيع المصروفات|مصروفات/.test(text) && !/لماذا|انخفض|ارتفع/.test(text)) {
    if (!c.topExpenses.length) {
      return {
        answer: `لا توجد مصروفات مسجلة في الفترة ${c.company.period.from} — ${c.company.period.to}. المصدر: قائمة الدخل.`,
        mode: "local",
        sources,
      };
    }
    const lines = c.topExpenses.map(
      (expense, index) => `${index + 1}. ${expense.name}: ${money(c, expense.amount)} (${expense.share.toFixed(1)}% من المصروفات)`,
    );
    return {
      answer: `أكبر بنود المصروفات في الفترة:\n\n${bullets(lines)}\n\nإجمالي المصروفات التشغيلية: ${money(
        c,
        c.totals.operatingExpenses,
      )}. المصدر: قائمة الدخل وتوزيع المصروفات.`,
      mode: "local",
      sources,
    };
  }

  if (/قارن|الشهر السابق|السابق|مقارنة/.test(text)) {
    const months = c.monthly.slice(-2);
    if (months.length < 2) {
      return {
        answer: "لا توجد بيانات شهرية كافية للمقارنة. ارفع بيانات تغطي شهرين على الأقل.",
        mode: "local",
        sources,
      };
    }
    const [previous, current] = months;
    const change = (a: number, b: number) => (b === 0 ? "غير متاح" : `${(((a - b) / Math.abs(b)) * 100).toFixed(1)}%`);
    return {
      answer: `مقارنة ${monthLabelOf(previous.period)} بـ${monthLabelOf(current.period)}:\n\n${bullets([
        `الإيرادات: ${money(c, previous.revenue)} → ${money(c, current.revenue)} (${change(current.revenue, previous.revenue)})`,
        `المصروفات: ${money(c, previous.expenses)} → ${money(c, current.expenses)} (${change(current.expenses, previous.expenses)})`,
        `صافي الربح: ${money(c, previous.profit)} → ${money(c, current.profit)} (${change(current.profit, previous.profit)})`,
      ])}\n\nالمصدر: التحليل الشهري المحسوب من القيود المرحّلة.`,
      mode: "local",
      sources,
    };
  }

  if (/لماذا.*(انخفض|انخفضت|تراجع)|سبب.*(انخفاض|تراجع)/.test(text)) {
    const drivers: string[] = [];
    if (c.changes.revenue !== null && c.changes.revenue < 0) drivers.push(`انخفاض الإيرادات بنسبة ${pct(c.changes.revenue)}`);
    if (c.changes.expenses !== null && c.changes.expenses > 0) drivers.push(`ارتفاع المصروفات بنسبة ${pct(c.changes.expenses)}`);
    if (c.topExpenses[0]) drivers.push(`تركّز المصروفات في «${c.topExpenses[0].name}» بنسبة ${c.topExpenses[0].share.toFixed(1)}%`);
    if (!drivers.length) drivers.push("لم يظهر تغير سلبي واضح في المؤشرات الرئيسية مقارنة بالفترة السابقة");
    return {
      answer: `أهم العوامل المؤثرة في الربح:\n\n${bullets(drivers)}\n\nصافي الربح الحالي ${money(
        c,
        c.totals.netProfit,
      )} بهامش ${c.totals.netMargin.toFixed(1)}%، وتغير الربح ${pct(c.changes.profit)}. المصدر: قائمة الدخل والتحليل المالي.`,
      mode: "local",
      sources,
    };
  }

  if (/مراجعة|تحتاج|الحسابات|ملاحظات|أخطاء/.test(text)) {
    if (!c.findings.length) {
      return {
        answer: "لم تُكتشف ملاحظات فحص في الفترة المحددة. راجع أيضاً القيود المكررة والعمليات غير المعتادة.",
        mode: "local",
        sources,
      };
    }
    const lines = c.findings.slice(0, 6).map(
      (finding) =>
        `${finding.title} (${SEVERITY_AR[finding.severity] ?? finding.severity})${finding.accountCode ? ` — حساب ${finding.accountCode}` : ""}: ${finding.recommendation}`,
    );
    return {
      answer: `أهم الحسابات والبنود التي تحتاج مراجعة:\n\n${bullets(lines)}\n\nإجمالي الملاحظات ${c.findings.length}. المصدر: وحدة الفحص المحاسبي.`,
      mode: "local",
      sources,
    };
  }

  if (/ربح|صافي|خسارة/.test(text)) {
    return {
      answer: `صافي الربح للفترة ${c.company.period.from} — ${c.company.period.to} هو ${money(
        c,
        c.totals.netProfit,
      )}، بهامش صافي ${c.totals.netMargin.toFixed(1)}%.\n\n${bullets([
        `صافي الإيرادات: ${money(c, c.totals.netRevenue)}`,
        `مجمل الربح: ${money(c, c.totals.grossProfit)}`,
        `المصروفات التشغيلية: ${money(c, c.totals.operatingExpenses)}`,
        `تغير الربح عن الفترة السابقة: ${pct(c.changes.profit)}`,
      ])}\n\nالمصدر: قائمة الدخل المحسوبة من القيود المرحّلة.`,
      mode: "local",
      sources,
    };
  }

  if (/إيراد|مبيعات/.test(text)) {
    return {
      answer: `صافي الإيرادات للفترة ${c.company.period.from} — ${c.company.period.to} هو ${money(
        c,
        c.totals.netRevenue,
      )}، بتغير ${pct(c.changes.revenue)} عن الفترة السابقة.\n\n${bullets([
        `مجمل الربح: ${money(c, c.totals.grossProfit)}`,
        `هامش مجمل الربح: ${c.totals.netRevenue > 0 ? ((c.totals.grossProfit / c.totals.netRevenue) * 100).toFixed(1) : "0.0"}%`,
        `عدد الأشهر في التحليل: ${c.monthly.length}`,
      ])}\n\nالمصدر: قائمة الدخل.`,
      mode: "local",
      sources,
    };
  }

  return {
    answer: `ملخص أداء ${c.company.name} للفترة ${c.company.period.from} — ${c.company.period.to}:\n\n${bullets([
      `صافي الإيرادات: ${money(c, c.totals.netRevenue)}`,
      `صافي الربح: ${money(c, c.totals.netProfit)} (هامش ${c.totals.netMargin.toFixed(1)}%)`,
      `إجمالي الأصول: ${money(c, c.totals.totalAssets)}`,
      `الملاحظات: ${c.findings.length}، منها ${c.findings.filter((f) => f.severity === "critical" || f.severity === "high").length} عالية الخطورة`,
      `اشتباه التكرار: ${c.duplicates.length} مجموعة`,
      `العمليات غير المعتادة: ${c.anomalies.length}`,
    ])}\n\nيمكنك السؤال عن: صافي الربح، أكبر المصروفات، القيود المكررة، مؤشرات السيولة، أو مقارنة شهرين.\n\nالمصدر: القوائم المالية ووحدات الفحص.`,
    mode: "local",
    sources,
  };
}

const SYSTEM_PROMPT = `أنت مساعد محاسبي في منصة "RAKAZ AI". أجب بالعربية الفصحى المبسطة وبإيجاز منظم.
قواعد صارمة:
1. استخدم فقط الأرقام الواردة في بيانات JSON المرفقة. لا تخترع أي رقم أو نسبة.
2. اذكر مصدر كل مجموعة أرقام (قائمة الدخل، المركز المالي، وحدة الفحص، التحليل الشهري).
3. لا تنفذ أو تقترح تعديلاً أو حذفاً لأي قيد أو بيانات.
4. إذا لم تكف البيانات للإجابة، قل ذلك بوضوح واذكر البيانات الناقصة.
5. ذكّر عند الحديث عن المخاطر أو التكرار أن النتائج مؤشرات للمراجعة وليست دليلاً على احتيال.
6. لا تعرض بيانات شركات أخرى، ولا تفترض بيانات غير موجودة.
7. استخدم نقاطاً قصيرة، وضع الأرقام المالية بين علامتي تنصيص عند الحاجة.
8. لا تجمع ولا تطرح ولا تحسب نسباً جديدة؛ استخدم القيم كما وردت حرفياً، وإذا احتجت قيمة غير موجودة فاذكر أنها غير متاحة.`;

async function callProvider(question: string, promptContext: string): Promise<string> {
  return callChatCompletion([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `بيانات الشركة (JSON):\n${promptContext}\n\nسؤال المستخدم: ${question}`,
    },
  ]);
}

export async function askAssistant(question: string, context: AssistantContext): Promise<AssistantAnswer> {
  const local = answerLocally(question, context);
  if (!isAiConfigured()) return local;

  const promptContext = formatContextForPrompt(context);

  try {
    const answer = await callProvider(question, promptContext);
    const ungrounded = findUngroundedNumbers(answer, promptContext);
    if (ungrounded.length) {
      return {
        ...local,
        fallbackReason:
          "مُنع عرض إجابة تحتوي أرقاماً غير مستمدة من بيانات الشركة؛ عُرضت إجابة محسوبة محلياً بدلاً منها.",
      };
    }
    return {
      answer,
      mode: "ai",
      sources: [
        "بيانات الشركة المحسوبة على الخادم",
        "قائمة الدخل والمركز المالي",
        "وحدات الفحص والتكرار والشذوذ",
      ],
    };
  } catch (error) {
    return {
      ...local,
      fallbackReason: `${describeProviderFailure(error)} عُرضت إجابة محسوبة محلياً.`,
    };
  }
}
