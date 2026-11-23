# قاعدة البيانات — RAKAZ AI

المخطط في `supabase/migrations/`:

| الملف | المحتوى |
| --- | --- |
| `0001_core.sql` | الملفات الشخصية، الشركات، الأعضاء، الفترات، الملفات والاستيراد |
| `0002_ledger.sql` | دليل الحسابات، القيود وسطورها، نتائج التحليل والتقارير |
| `0003_security.sql` | دوال الصلاحيات وسياسات RLS والفهارس |
| `0004_rbac.sql` | الأدوار والصلاحيات والأدوار المخصصة (`roles`, `role_permissions`, `user_roles`) ودالة `has_permission` |

## الجداول

### الهوية والشركات

| الجدول | أهم الأعمدة |
| --- | --- |
| `profiles` | `id` (= auth.users)، `email`، `full_name`، `is_super_admin` |
| `companies` | `name`، `legal_name`، `activity_type`، `country`، `currency`، `fiscal_year_start/end`، `entity_type`، `status`، `created_by` |
| `company_members` | `company_id`، `user_id`، `role` (`owner/admin/senior_accountant/accountant/auditor/viewer`)، `custom_role_id` — فريد (شركة، مستخدم) |
| `roles` | `company_id` (فارغ للأدوار النظامية)، `key`، `name`، `is_system`، `created_by` |
| `role_permissions` | `role_id` + `permission` (مفتاح مركب) |
| `user_roles` | `user_id`، `role_id`، `company_id`، `branch_id` — أدوار متعددة ونطاق فرع |
| `accounting_periods` | `company_id`، `label`، `start_date`، `end_date`، `is_closed` |

### المحاسبة

| الجدول | أهم الأعمدة |
| --- | --- |
| `accounts` | `company_id`، `code`، `name`، `type`، `subtype`، `parent_code`، `normal_side` — فريد (شركة، رمز) |
| `journal_entries` | `company_id`، `entry_number`، `entry_date`، `description`، `reference`، `source`، `batch_id`، `posted` |
| `journal_entry_lines` | `entry_id`، `account_code`، `debit`، `credit`، `description`، `cost_center` (أرقام عشرية كنص) |

### الاستيراد والتتبع

| الجدول | أهم الأعمدة |
| --- | --- |
| `uploaded_files` | `company_id`، `file_name`، `mime_type`، `size_bytes`، `checksum` (SHA-256)، `storage_path`، `uploaded_by` |
| `import_batches` | `company_id`، `file_id`، `dataset`، `sheet_name`، `row_count`، `imported_count`، `status`، `warnings` (JSONB) |
| `imported_records` | `batch_id`، `company_id`، `dataset`، `sheet_name`، `row_number`، `payload` (JSONB)، `entry_id` |

فهرس فريد على (`company_id`, `checksum`, `dataset`) في `uploaded_files` يمنع إعادة استيراد
الملف نفسه.

### نتائج التحليل

| الجدول | أهم الأعمدة |
| --- | --- |
| `audit_findings` | `company_id`، `code`، `title`، `description`، `severity`، `account_code`، `entry_number`، `amount`، `reason`، `recommendation`، `status`، `period_from/to` |
| `duplicate_findings` | `company_id`، `kind`، `strength`، `score`، `entry_ids` (JSONB)، `reasons` (JSONB)، `recommendation` |
| `financial_reports` | `company_id`، `period_from/to`، `payload` (JSONB)، `generated_by`، `created_at` |
| `analysis_results` | `company_id`، `kind`، `period_from/to`، `payload` (JSONB) |
| `activity_logs` | `company_id`، `user_id`، `action`، `entity`، `entity_id`، `metadata` (JSONB) |

## سياسات RLS

كل الجداول التشغيلية مُفعّل عليها RLS. المبدأ:

```text
المستخدم يرى الشركة إذا كان عضواً في company_members
أو كان is_super_admin (للإدارة فقط، وليس لقراءة القيود)
الكتابة تتطلب دوراً مناسباً (owner/admin/accountant) حسب الجدول
```

دوال مساعدة (Security Definer بمسار بحث آمن):

- `public.is_company_member(company_id)`
- `public.has_company_role(company_id, roles[])`
- `public.is_super_admin()`

أمثلة من السياسات:

```sql
create policy accounts_select on public.accounts for select
  using (public.is_company_member(company_id));

create policy accounts_write on public.accounts for all
  using (public.has_company_role(company_id, array['owner','admin','accountant']))
  with check (public.has_company_role(company_id, array['owner','admin','accountant']));
```

الملفات نفسها تُخزَّن في Supabase Storage داخل مسار يبدأ بمعرّف الشركة، مع سياسات وصول
مطابقة (قراءة للأعضاء، كتابة للأدوار المخوّلة).

## الفهارس

- `accounts(company_id, code)` فريد.
- `journal_entries(company_id, entry_date)` و `(company_id, entry_number)`.
- `journal_entry_lines(entry_id)` و `(account_code)`.
- `imported_records(batch_id)` و `(company_id, dataset)`.
- `audit_findings(company_id, status)` و `(company_id, severity)`.

## جداول الرقابة الداخلية (0005)

- `audit_logs(id, company_id, user_id, action, entity, entity_id, from_status, to_status, note, meta, created_at)`
  — إلحاقي فقط؛ قراءة بصلاحية `audit.view`، ولا تحديث ولا حذف.
- `journal_entries` اكتسبت `submitted_by/at`, `approved_by/at`, `posted_by/at`, `rejected_by/at`, `review_note`.
- فهرس `journal_entries(company_id, status)` لتسريع قائمة العمل.

## تطبيق الترحيلات

عبر SQL Editor في Supabase بالترتيب، أو باستخدام Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

> لا تشغّل `0003_security.sql` قبل `0001` و`0002` لأن الدوال تعتمد على الجداول.
