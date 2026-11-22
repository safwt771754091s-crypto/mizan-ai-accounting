# البنية المعمارية — Mizan AI

## 1. نظرة عامة

```text
المتصفح (React 19 / RTL)
   │  Server Components + Server Actions
   ▼
Next.js 16 App Router  ── proxy.ts (حماية المسارات)
   │
   ├── طبقة العرض        src/app/(app)/*        صفحات الشركة والفترة
   ├── طبقة التطبيق      src/app/actions/*     Server Actions
   ├── طبقة الـ API      src/app/api/*         استيراد، تصدير، مساعد
   │
   ├── المحرك المحاسبي   src/lib/accounting/*  دوال نقية قابلة للاختبار
   ├── الاستيراد         src/lib/import/*      قراءة، اكتشاف، تحقق، بناء
   ├── المستودع          src/lib/data/*        Demo (JSON) أو Supabase
   ├── المصادقة          src/lib/auth/*        Demo HMAC أو Supabase Auth
   └── الذكاء            src/lib/ai/*          سياق منظم + إجابة محلية/LLM
```

الفصل الأساسي: **المحرك لا يعرف الواجهة ولا قاعدة البيانات**. يستقبل `Ledger`
(حسابات + قيود + عملة) ويعيد نتائج مالية خالصة، ما يجعل الحسابات قابلة لإعادة الاختبار
بنفس المدخلات.

## 2. تدفق الطلب

1. `proxy.ts` يتحقق من وجود جلسة ويحمي مسارات التطبيق ويعيد الزائر إلى `/login`.
2. الصفحة تستدعي `loadCompanyContext(companyId)`:
   - يتحقق من المستخدم،
   - يجلب شركاته من المستودع،
   - يختار الشركة المطلوبة **بعد** التحقق من العضوية،
   - يحمّل بياناتها ويبني `Ledger`.
3. الصفحة تستدعي دوال المحرك: `buildTrialBalance`، `buildIncomeStatement`،
   `buildBalanceSheet`، `buildFinancialAnalysis`، `detectAuditFindings`، `detectDuplicates`،
   `detectAnomalies`.
4. العرض عبر مكونات `components/app` (جداول، رسوم، بطاقات).

## 3. المستودع (Repository)

`src/lib/data/repository.ts` يعرّف واجهة مجردة، وينفّذها:

- `store.ts` + `demo-data.ts`: تخزين JSON محلي في `.mizan-data/demo-store.json`.
  كل كتابة تُسلسل عبر طابور، والقراءة تتحقق من بصمة الملف (mtime + size) حتى لا تبقى نسخة
  قديمة في الذاكرة بين مسار الصفحات ومسار الـ API.
- `supabase-repository.ts`: تنفيذ SQL عبر Supabase مع تمرير جلسة المستخدم لتفعيل RLS.

اختيار الوضع في `src/lib/supabase/config.ts`:

```text
MIZAN_DATA_MODE = demo | supabase
إن لم يُحدد: supabase إذا وُجدت NEXT_PUBLIC_SUPABASE_URL و ANON_KEY، وإلا demo.
```

## 4. مسار الاستيراد

```text
رفع الملف ─► /api/import/parse ─► parseFile()        (ExcelJS / PapaParse / pdf-parse)
                               └► detectColumns()    (مطابقة أسماء عربية/إنجليزية)
                               └► validateRows()     (تحقق نوعي + مبالغ + تواريخ)
                               └► checksum SHA-256   (منع التكرار)
معاينة وربط ─► /api/import/confirm ─► planImport()   (صفوف ← قيود/أرصدة)
                                   └► repo.saveImport() (ملف + دفعة + سجلات + قيود)
```

كل سجل مستورد يحمل: `fileId`, `batchId`, `sheetName`, `rowNumber` — ليمكن تتبع أي رقم
إلى مصدره.

## 5. المحرك المحاسبي

| ملف | المسؤولية |
| --- | --- |
| `money.ts` | Decimal، تنسيق، تحويل آمن |
| `accounts.ts` | أنواع الحسابات، التصنيفات، الطبيعة المدينة/الدائنة |
| `engine.ts` | تجميع القيود، الأرصدة الافتتاحية، ميزان المراجعة |
| `statements.ts` | قائمة الدخل، المركز المالي، التدفقات، حقوق الملكية |
| `ratios.ts` | النسب والاتجاهات الشهرية |
| `findings.ts` | فحص القيود والحسابات |
| `duplicates.ts` | كشف التكرار متعدد المعايير |
| `anomalies.ts` | قواعد المخاطر والمصروفات غير المعتادة |

## 6. المساعد الذكي

- `context.ts` يبني كائن JSON منظم من نتائج المحرك (أرقام فقط، لا نصوص حرة).
- `agent.ts`:
  - `answerLocally()`: مطابقة نية السؤال (عربية) وإجابة حتمية من السياق — تعمل دائماً.
  - `answerWithAi()`: إن وُجد `AI_PROVIDER_API_KEY` يُرسل السياق + السؤال إلى مزود
    متوافق مع Chat Completions بحرارة 0، ويُمنع في الـ prompt اختلاق الأرقام.
  - أي خطأ شبكي/مزود ← رجوع تلقائي للإجابة المحلية مع `fallbackReason`.
- `/api/assistant` يبني السياق من جلسة المستخدم والشركة المطلوبة فقط، ويرفض أي
  `companyId` غير مصرح به.

## 7. التقارير

`src/lib/reports/build.ts` يبني هيكلاً واحداً (20 قسماً) يُستخدم في:

- صفحة `/reports` (عرض عربي جاهز للطباعة)،
- `/api/reports/export` (ملف XLSX متعدد الأوراق عبر ExcelJS).

## 8. الواجهة

- `components/app/app-shell.tsx`: Sidebar + مبدّل الشركة + دور المستخدم.
- `components/ui/*`: أزرار، بطاقات، جداول، حقول، شارات (Radix + Tailwind).
- الرسوم: `components/app/charts.tsx` (Recharts) — تستقبل بيانات محسوبة فقط.
- التصميم: أخضر داكن `brand`، فيروزي `teal`، رمادي، وألوان خطر واضحة.

## 9. قرارات تقنية

| القرار | السبب |
| --- | --- |
| Decimal.js | دقة مالية ومنع أخطاء floating point |
| محرك نقي منفصل | اختبار حتمي وإعادة استخدام في التقارير والمساعد |
| وضع Demo بمستودع JSON | تشغيل فوري دون خدمات خارجية + اختبارات E2E |
| Supabase + RLS | عزل الشركات على مستوى الصف، وأمان حتى لو أخطأ كود التطبيق |
| ExcelJS | قراءة وكتابة XLSX بثبات ودعم الأنماط في التصدير |
| PDF نصي فقط | لا ندّعي OCR غير موجود |
| LLM اختياري | لا تعطيل للمنصة عند غياب المفتاح، ولا اختراع أرقام |
