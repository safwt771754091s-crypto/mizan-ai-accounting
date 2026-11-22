# نظام الصلاحيات والرقابة — RAKAZ AI

هذا الملف يوثق **المرحلة الأولى**: أساس نظام صلاحيات مؤسسي (RBAC) قابل للتخصيص، مع تحقق مركزي على الخادم وقاعدة بيانات.

## 1. المبادئ

1. **الرفض هو الافتراضي**: أي طلب بلا صلاحية صريحة يُرفض.
2. **مصدر واحد للحقيقة**: كتالوج الصلاحيات في `src/lib/auth/permission-catalog.ts`، ومصفوفة الأدوار النظامية مطابقة له في `supabase/migrations/0004_rbac.sql`. اختبار آلي يحرس التطابق.
3. **الخادم هو الحَكَم**: إخفاء العناصر في الواجهة تجربة استخدام فقط، وليس أماناً. كل صفحة وكل API وكل Server Action تتحقق من الصلاحية.
4. **النطاق من العضوية لا من الرابط**: `companyId` القادم من المتصفح يُستخدم للبحث فقط، والصلاحية تُشتق من عضوية المستخدم الفعلية في تلك الشركة.
5. **مدير المنصة لا يكتب في دفاتر العملاء**: صلاحيات `platform.*` لا تشمل أي صلاحية محاسبية.

## 2. كتالوج الصلاحيات

الأسماء بصيغة `الوحدة.العملية`:

| المجموعة | الصلاحيات |
| --- | --- |
| الشركة | `company.read`, `company.settings.manage`, `company.members.read`, `company.members.manage`, `company.roles.manage`, `company.branches.manage` |
| دليل الحسابات | `accounts.read`, `accounts.manage` |
| القيود | `journal.read`, `journal.create`, `journal.edit_draft`, `journal.submit`, `journal.approve`, `journal.post`, `journal.reverse`, `journal.export` |
| الاستيراد | `imports.read`, `imports.create` |
| الفترات | `periods.read`, `periods.close`, `periods.reopen` |
| التقارير | `reports.view`, `reports.export` |
| المراجعة | `findings.view`, `findings.review`, `audit.view` |
| المقترحات (مرحلة 3) | `proposals.create`, `proposals.view`, `proposals.triage` |
| المنصة | `platform.users.read`, `platform.users.manage`, `platform.companies.read`, `platform.companies.manage`, `platform.settings.manage`, `platform.audit.view`, `platform.proposals.manage`, `platform.stats.view` |

## 3. الأدوار

### أدوار الشركة

| الدور | المفتاح | الجوهر |
| --- | --- | --- |
| مالك | `owner` | كل صلاحيات الشركة، إدارة الأدوار، إعادة فتح الفترات. لا يمكن تقييده بدور مخصص. |
| مدير | `admin` | إدارة العمليات والمستخدمين، **دون** إدارة الأدوار أو إعادة فتح الفترات. |
| محاسب أول | `senior_accountant` | إنشاء القيود وترحيلها (`journal.post`) وإدارة الدليل والاستيراد، دون الاعتماد. |
| محاسب | `accountant` | إنشاء القيود وإرسالها، والاستيراد، دون ترحيل نهائي. |
| مراجع | `auditor` | قراءة كاملة + مراجعة الاكتشافات + سجل التدقيق، دون أي كتابة. |
| مشاهد | `viewer` | قراءة التقارير والبيانات فقط. |

المصفوفة الكاملة معروضة في صفحة «المستخدمون والصلاحيات» ومولّدة من الكود نفسه.

### أدوار المنصة

| الدور | المصدر | ملاحظة |
| --- | --- | --- |
| `super_admin` | `profiles.role = 'super_admin'` | كل صلاحيات `platform.*`، ولا صلاحية على دفاتر العملاء. |
| `platform_admin` | يُضاف في المرحلة الثانية (`user_roles`) | قراءة المستخدمين والشركات والإحصاءات وسجل تدقيق المنصة. |

## 4. الأدوار المخصصة

- تُنشأ داخل الشركة بواسطة من يملك `company.roles.manage` (المالك افتراضياً).
- **تستبدل** صلاحيات الدور النظامي للعضو المعيّن، ولا تُضاف إليها — هذا يمنع التصعيد غير المقصود.
- المالك لا يتأثر بأي دور مخصص.
- حذف الدور يعيد أعضاءه إلى دورهم النظامي تلقائياً.
- على مستوى قاعدة البيانات: `roles.company_id` يحدد النطاق، ومُشغّل `company_members_custom_role_guard` يرفض تعيين دور من شركة أخرى.

## 5. نقاط التحقق (Enforcement)

| الطبقة | الملف | الأسلوب |
| --- | --- | --- |
| قرار مركزي | `src/lib/auth/permission-catalog.ts` | `can(subject, permission)` |
| حالة الشركة | `src/lib/auth/permissions.ts` | `resolveCompanyPermission(user, companyId)` |
| بوابة API/Actions | `src/lib/auth/permissions.ts` | `assertCompanyPermission(user, companyId, permission)` → 401/403 |
| الصفحات | `src/lib/data/context.ts` | `ctx.allows(permission)` + `<AccessDenied />` |
| التنقل | `src/components/app/app-shell.tsx` | إخفاء الروابط غير المسموحة |
| قاعدة البيانات | `supabase/migrations/0004_rbac.sql` | `has_permission(company_id, permission)` + سياسات RLS |

المسارات المحمية حالياً:

- `POST /api/import/parse` و`POST /api/import/confirm` → `imports.create`
- `GET /api/reports/export` → `reports.export`
- `POST /api/assistant` → `reports.view`
- صفحات `/users` (`company.members.read`)، `/upload` (`imports.create`)
- Server Actions: تحديث الشركة (`company.settings.manage`)، دعوة/تعديل/إزالة عضو (`company.members.manage`)، الأدوار المخصصة (`company.roles.manage`)، مراجعة الاكتشافات (`findings.review`)

## 6. قاعدة البيانات

```sql
roles(id, company_id, key, name, description, is_system, created_by, created_at)
role_permissions(role_id, permission)          -- مفتاح مركب
user_roles(user_id, role_id, company_id, branch_id)  -- أدوار متعددة ونطاق فرع (مرحلة 2)
company_members.custom_role_id → roles(id)
```

دالة `public.has_permission(target uuid, perm text)` تحسب الصلاحية من العضوية والدور المخصص أو النظامي، وتُستخدم داخل سياسات RLS للجداول الجديدة.

> **ملاحظة انتقالية**: سياسات `0003_security.sql` ما زالت تعتمد `has_company_role(company_id, roles[])`. تحويلها إلى `has_permission` يتم في المرحلة الثانية بعد تغطية اختبارات التكامل على قاعدة بيانات حقيقية، حتى لا نغيّر سلوك الإنتاج دون تحقق.

## 7. الاختبارات

| الملف | التغطية |
| --- | --- |
| `src/tests/permissions.test.ts` | الكتالوج، مصفوفة الأدوار، الرفض الافتراضي، الأدوار المخصصة، صلاحيات المنصة، وتطابق SQL مع الكود |
| `src/tests/rbac-repository.test.ts` | تحقق داخل نطاق الشركة، 401/403، الأدوار المخصصة، منع تسرب الأدوار بين الشركات |
| `e2e/rbac.spec.ts` | رفض الصفحات على الخادم، إخفاء التنقل، فرق المالك/المدير، تعديل `company` في الرابط، إنشاء دور مخصص |

لا تُستخدم Mock في اختبارات العزل: الاختبارات تعمل على مستودع البيانات الحقيقي (وضع demo) وتمر بمسار التحقق نفسه الذي يستخدمه الإنتاج.

## 8. ما لم يُنفّذ بعد (المراحل التالية)

| المرحلة | المحتوى |
| --- | --- |
| الثانية | الرقابة الداخلية: فصل المهام، مسارات اعتماد متعددة، إغلاق الفترات، سجل تدقيق موسّع، `audit_logs` + `approval_*` |
| الثالثة | مركز التطوير والمقترحات + ربط GitHub Issues |
| الرابعة | تحويل سياسات RLS من `has_company_role` إلى `has_permission` بعد اختبار تكامل على Supabase فعلي |
