# الأمن — RAKAZ AI

## 1. المصادقة والجلسات

| الوضع | الآلية |
| --- | --- |
| Demo | جلسة داخل كوكي `httpOnly` موقّعة بـ HMAC-SHA256، ومقارنة بزمن ثابت |
| Supabase | Supabase Auth عبر `@supabase/ssr`، وتُقرأ الجلسة على الخادم لكل طلب |

- كلمات مرور Demo تُخزَّن كـ scrypt مع salt عشوائي.
- كوكي الجلسة: `httpOnly`, `sameSite=lax`, `secure` في الإنتاج، ومدة محدودة.
- `RAKAZ_DEMO_SESSION_SECRET` إلزامي في الإنتاج؛ القيمة الافتراضية للتطوير فقط.

## 2. التفويض وعزل الشركات

ثلاث طبقات متتالية:

1. **المسار**: `proxy.ts` يعيد غير المسجلين إلى `/login` ويحمي كل مسارات التطبيق.
2. **السياق**: `loadCompanyContext` لا يختار شركة إلا من قائمة شركات المستخدم؛ أي
   `companyId` خارج القائمة يُتجاهل ويُستبدل بأول شركة مسموحة.
3. **قاعدة البيانات**: RLS على كل جدول تشغيلي، والتحقق من الدور للكتابة.

الأدوار: `owner` > `admin` > `accountant` > `auditor` > `viewer`. عمليات الاستيراد
والتعديل تتطلب `owner/admin/accountant`؛ المراجعة تتطلب دوراً غير `viewer`؛ القراءة فقط
متاحة للجميع.

## 2.1 سياسات RLS القائمة على الصلاحيات (المرحلة 4)

قبل الترحيل `0007_rls_permissions.sql` كانت سياسات `0003` تفحص الدور النظامي
(`has_company_role`)، وهي تقرأ `company_members.role` فقط. النتيجة: عضو بدور مخصص كان
إمّا يفقد وصوله في قاعدة البيانات أو يحتفظ بوصول دوره النظامي السابق، فيتعارض ما تسمح به
قاعدة البيانات مع ما تسمح به الواجهة.

بعد 0007 كل سياسة تقرأ من نفس كتالوج الصلاحيات المستخدم في الكود (`has_permission`).

| الجدول | قراءة | كتابة |
| --- | --- | --- |
| `companies` | `company.read` (أو المُنشئ) | `company.settings.manage` |
| `company_members` | صفّك دائماً + `company.members.read` للقائمة | `company.members.manage` |
| `accounting_periods` | `periods.read` | `periods.close` / `periods.reopen` (بلا حذف) |
| `accounts` | `accounts.read` | `accounts.manage` |
| `journal_entries` | `journal.read` | `journal.create` / `edit_draft` / `submit` / `approve` / `post` / `reverse` |
| `journal_entry_lines` | `journal.read` | `journal.create` / `journal.edit_draft` / `journal.submit` |
| `uploaded_files` / `import_batches` / `imported_records` | `imports.read` | `imports.create` |
| `audit_findings` | `findings.view` | `findings.review` |
| `duplicate_findings` | `findings.view` | `findings.review` (باستثناء دور «مراجع») |
| `financial_reports` / `analysis_results` | `reports.view` | `reports.export` |
| `activity_logs` | `company.read` | `company.read` + `user_id = auth.uid()` |
| `audit_logs` | `audit.view` | `company.read` + `user_id = auth.uid()` |
| `proposals` | `proposals.view` | `proposals.create` / `proposals.triage` |
| `roles` / `role_permissions` | `is_system` أو دورك المخصص أو `company.members.read` | `company.roles.manage` |
| `user_roles` | دورك أو `company.members.read` | `company.members.manage` |
| `storage.objects` (`company-files`) | `imports.read` | `imports.create` |

### استثناءات مقصودة

- **قراءة العضوية الذاتية:** كل عضو يقرأ صفّه في `company_members` دائماً، لأن التطبيق يبني منه
  قائمة الشركات والصلاحيات. القائمة الكاملة تحتاج `company.members.read`.
- **الدور المخصص الخاص بك:** `is_my_role(role_id)` تسمح بقراءة الدور والصلاحيات المسندة إليك
  حتى لو لم تملك `company.members.read`، وإلا تعذّر بناء سياق عضو بدور مخصص.
- **بلا حذف:** لا سياسة حذف على `accounting_periods` و`audit_findings` و`financial_reports`.
  حذف القيود مقصور على `journal.reverse` (إلغاء محاسبي موثّق)، لا حذفاً فيزيائياً.
- **`has_company_role` باقٍ في موضعين فقط** داخل سياسات الكتابة على `duplicate_findings`
  للحفاظ على استثناء دور «مراجع» كما كان.

### اختبار التكامل على قاعدة حقيقية

```bash
# في SQL Editor داخل Supabase، أو:
psql "$SUPABASE_DB_URL" -f supabase/tests/rls_permissions.sql
```

السكربت ينشئ شركتين ومستخدمين وأدواراً تجريبية، يبدّل الهوية عبر `request.jwt.claims`،
يتحقق من العزل ومن منع الكتابة ومن احترام الدور المخصص، ثم ينفّذ `rollback` (لا يترك أثراً).
النتيجة المطلوبة: كل السطور `PASS` وسطر أخير `ALL RLS CHECKS PASSED`.

## 3. استيراد الملفات

| الفحص | التفصيل |
| --- | --- |
| الامتداد | `xlsx`, `xls`, `csv`, `pdf` فقط |
| النوع الفعلي | مطابقة magic bytes (ZIP لـ XLSX، `%PDF`، نص لـ CSV) |
| الحجم | حد أقصى 15MB |
| الاسم | يُعقَّم ولا يُستخدم كمسار |
| التكرار | SHA-256 على المحتوى، فريد لكل (شركة، نوع، ملف) |
| التنفيذ | لا يُنفَّذ أي محتوى من الملف؛ قراءة فقط عبر مكتبات مخصصة |
| التخزين | Supabase Storage بمسار يبدأ بمعرّف الشركة، أو معالجة في الذاكرة في Demo |

لا تُرسل الملفات إلى أي خدمة خارجية، ولا يُستخدم الذكاء الاصطناعي في الحسابات الأساسية.

## 4. واجهات API

- `/api/import/parse` و `/api/import/confirm`: تتطلب جلسة، وتتحقق من العضوية والدور قبل
  قراءة الملف، وتتحقق من تطابق البصمة بين المعاينة والتأكيد.
- `/api/reports/export`: تتطلب جلسة وعضوية، وتُبنى من نفس محرك الصفحة.
- `/api/assistant`: تبني السياق من شركة المستخدم فقط؛ لا تقبل شركة غير مصرح بها، ولا
  تنفّذ أي عملية كتابة.
- لا تُعيد أي واجهة رسائل أخطاء داخلية أو stack traces؛ الرسائل عربية عامة.

## 5. رؤوس الأمان (`next.config.ts`)

```text
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-DNS-Prefetch-Control: off
```

## 6. الأسرار

- `.env.local` فقط، وهو مستثنى من Git مع `.env*.local`.
- `.env.example` يحتوي أسماء المتغيرات دون قيم.
- `SUPABASE_SERVICE_ROLE_KEY` لا يُستخدم في أي كود متصفح ولا في `NEXT_PUBLIC_*`.
- `AI_PROVIDER_API_KEY` يُقرأ على الخادم فقط داخل `/api/assistant`.

## 7. سجل العمليات

`activity_logs` يسجل العمليات المهمة: استيراد، إنشاء شركة، دعوة عضو، تغيير إعدادات،
إعادة ضبط البيانات التجريبية — مع المستخدم والوقت والكيان المتأثر.

## 8. الذكاء الاصطناعي

- النموذج يتلقى **أرقاماً محسوبة مسبقاً** فقط، مع تعليمات صريحة بعدم الحساب أو الاختلاق.
- لا يملك أدوات كتابة؛ لا يستطيع تعديل قيد أو حذف بيانات.
- عند فشل المزود تُعاد الإجابة المحلية الحتمية مع سبب واضح.
- لا تُرسل بيانات شركة إلى المزود إلا بطلب المستخدم نفسه (سؤال في المساعد) وبعد وجود مفتاح.

## 9. سلوك التخزين عند تعذّر الحفظ

- لا تعتمد المنصة على قدرة الكتابة على القرص لتقديم الصفحات: قراءة بيانات الوضع التجريبي
  تعمل حتى على نظام ملفات للقراءة فقط (Vercel).
- عند فشل الحفظ يُسجَّل تحذير واضح في سجل الخادم (`[rakaz] تعذّر حفظ ...`) ويُستخدم تخزين
  مؤقت في الذاكرة، بدل إخفاء الخطأ أو إسقاط الطلب بخطأ 500.
- لا يُعطَّل أي فحص صلاحيات أو عزل شركات بسبب هذا السلوك؛ الحفظ والتحقق مساران منفصلان.
- للبيانات الدائمة إعداد Supabase إلزامي في الإنتاج.

## 10. ما لا يفعله النظام

- لا يدّعي أنه يقدم رأياً قانونياً أو تقرير مراجعة معتمد.
- لا يحذف بيانات دون تأكيد صريح من المستخدم.
- لا يعتبر أي عملية مشبوهة دليلاً على احتيال.

## تطبيق الويب المثبّت (PWA)

- **لا يُخزَّن أي HTML محاسبي** في الكاش: كل صفحة محمية تُطلب من الخادم مع الكوكيز في كل مرة،
  فلا يمكن استخدام الكاش لتجاوز المصادقة أو RLS. التفاصيل في `docs/pwa.md`.
- الأصول الثابتة فقط (`/_next/static/*`، الأيقونات، الخطوط) هي القابلة للتخزين، ولا تُخزَّن أي
  استجابة تحمل `Set-Cookie` أو أي طلب إلى `/api/*` أو Supabase.
- عند تسجيل الخروج تُرسل رسالة `PURGE` إلى الـ Service Worker لحذف كل الكاشات.
- `public/sw.js` يُقدَّم بـ `Cache-Control: no-cache` و`Service-Worker-Allowed: /` من `next.config.ts`،
  حتى يلتقط المتصفح النسخة الجديدة ولا تبقى نسخة قديمة مسيطرة.
- التحديث لا يُفعَّل تلقائياً؛ يتطلب موافقة المستخدم (`SKIP_WAITING` بعد «تحديث الآن»)، مع حارس
  ضد حلقات إعادة التحميل.
- لا تُخزَّن أي أسرار أو مفاتيح في الـ manifest أو الـ Service Worker أو الكاش.
