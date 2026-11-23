# مركز المقترحات (المرحلة 3)

أفكار التطوير داخل الشركة تُقدَّم وتُفرز وتُحوَّل إلى Issue على GitHub. الهدف: تحويل
«ملاحظات المستخدمين» إلى عمل هندسي متتبَّع، دون منح أي عضو صلاحية كتابة على المستودع.

## دورة الحياة

```
new ──review──▶ under_review ──accept──▶ accepted ──ship──▶ shipped
 │                    │                    │
 └──────accept────────┘                    └──dispatch──▶ Issue #N على GitHub
 │                    │
 └────reject──────────┴──────▶ rejected  (نهائية)
```

- `new` ← كل مقترح جديد.
- `under_review` ← قيد الدراسة (اختياري).
- `accepted` ← معتمد، والوحيد القابل للإرسال إلى GitHub.
- `rejected` ← يتطلب سبباً مكتوباً، ويبقى في السجل.
- `shipped` ← نُفّذ؛ لا رجوع ولا تعديل بعدها.

القواعد في `src/lib/proposals/rules.ts` (`canTransitionProposal`, `transitionProposalError`,
`canDispatchProposal`) — دوال نقية تُختبر مباشرة.

## الصلاحيات

| الإجراء | الصلاحية | الأدوار النظامية |
| --- | --- | --- |
| عرض المقترحات | `proposals.view` | كل الأعضاء |
| تقديم مقترح | `proposals.create` | المالك، المدير، المحاسب الأول |
| الفرز وتغيير الحالة | `proposals.triage` | المالك، المدير |
| الإرسال إلى GitHub | `proposals.triage` + تهيئة الخادم | المالك، المدير |

لا تُمنح صلاحية كتابة على GitHub لأي عضو: التوكن يعيش على الخادم فقط
(`GITHUB_ISSUES_TOKEN`)، ولا يصل إلى المتصفح ولا إلى قاعدة البيانات.

## الأمان

- إنشاء الـ Issue يحدث في Server Action بعد `assertCompanyPermission(..., "proposals.triage")`.
- لا يُرسل إلا مقترح `accepted` ولم يُرسل سابقاً (منع التكرار).
- يُسجَّل كل إرسال في `audit_logs` مع رقم الـ Issue ورابطه.
- الرسائل الراجعة من GitHub تُترجم إلى رسائل عربية عامة؛ لا يُعاد نص استجابة GitHub
  ولا يُطبع التوكن في أي سجل أو خطأ.
- إن فشل ربط الـ Issue بعد إنشائه، تُعرض رسالة تحتوي الرابط كي لا يضيع الأثر.

## الإعداد

```bash
# .env.local — لا يُرفع إلى Git
GITHUB_ISSUES_TOKEN=github_pat_...
GITHUB_ISSUES_REPO=safwt771754091-crypto/mizan-ai-accounting   # اختياري
GITHUB_ISSUES_LABELS=proposal                                    # اختياري
```

الصلاحية المطلوبة للتوكن: **Issues: write** (fine-grained) أو `repo` (classic).
بدون التوكن تظهر في الصفحة ملاحظة أن الإرسال غير مُهيّأ، ويبقى الفرز والاعتماد يعملان.

## قاعدة البيانات

`public.proposals` في `supabase/migrations/0006_proposals.sql`:

| العمود | النوع |
| --- | --- |
| `id`, `company_id`, `created_by` | uuid |
| `title` | 4–140 حرفاً |
| `body` | 20–4000 حرف |
| `category` | workflow / report / import / ux / other |
| `priority` | low / medium / high |
| `status` | new / under_review / accepted / rejected / shipped |
| `decision_note`, `issue_number`, `issue_url` | اختيارية |
| `created_at`, `updated_at` | timestamptz |

RLS: قراءة بـ `proposals.view`، إلحاق بـ `proposals.create` و`created_by = auth.uid()`،
تحديث بـ `proposals.triage`، و`delete` مسحوب عن `authenticated` و`anon`.

## ما لم يُنفَّذ بعد

- إشعارات عند تغيّر حالة المقترح.
- مزامنة عكسية: تحديث حالة المقترح تلقائياً عند إغلاق الـ Issue على GitHub.
- تعليقات على المقترح داخل المنصة.
- لوحة مقترحات على مستوى المنصة لمدير النظام (الصلاحية `platform.proposals.manage` جاهزة).
