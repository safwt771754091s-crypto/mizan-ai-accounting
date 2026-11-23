-- 0007_rls_permissions.sql
-- المرحلة 4: تحويل سياسات RLS من فحص الدور النظامي إلى فحص الصلاحية.
--
-- المشكلة قبل هذا الترحيل: سياسات 0003 تستخدم has_company_role(...)، وهي تقرأ عمود
-- company_members.role فقط. من يُسنَد له دور مخصص (custom_role_id) يفقد وصوله أو يحتفظ
-- بوصول دوره النظامي السابق، فتتعارض قاعدة البيانات مع طبقة التطبيق التي تعتمد has_permission.
--
-- بعد هذا الترحيل: كل سياسة تُقرأ من نفس كتالوج الصلاحيات المستخدم في الكود، فالدور المخصص
-- يعمل في RLS كما يعمل في الواجهة، وأي توسيع مستقبلي للصلاحيات يسري في الطبقتين معاً.
--
-- ملاحظات سلوكية مقصودة (موثّقة في docs/security.md):
--   * الحذف في الجداول المحاسبية لم يُوسَّع؛ صار مربوطاً بصلاحيات فعلية بدل الدور.
--   * accounting_periods: الإنشاء بـ periods.close، والتحديث بـ periods.close أو periods.reopen،
--     والحذف ممنوع تماماً (لا سياسة حذف).
--   * duplicate_findings: الكتابة تتطلب findings.review مع استثناء دور «مراجع» للحفاظ على السلوك السابق.

-- ========== الشركة والعضوية ==========
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select using (
    public.has_permission(id, 'company.read') or created_by = auth.uid()
  );

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
  for update using (public.has_permission(id, 'company.settings.manage'))
  with check (public.has_permission(id, 'company.settings.manage'));

drop policy if exists members_select on public.company_members;
-- العضو يقرأ صفّه دائماً (لازم لتحميل الشركات والصلاحيات)، وقائمة الأعضاء تحتاج company.members.read.
create policy members_select on public.company_members
  for select using (
    user_id = auth.uid() or public.has_permission(company_id, 'company.members.read')
  );

drop policy if exists members_insert on public.company_members;
create policy members_insert on public.company_members
  for insert with check (
    (user_id = auth.uid() and role = 'owner' and public.is_company_creator(company_id))
    or public.has_permission(company_id, 'company.members.manage')
  );

drop policy if exists members_update on public.company_members;
create policy members_update on public.company_members
  for update using (public.has_permission(company_id, 'company.members.manage'))
  with check (public.has_permission(company_id, 'company.members.manage'));

drop policy if exists members_delete on public.company_members;
create policy members_delete on public.company_members
  for delete using (
    public.has_permission(company_id, 'company.members.manage') and role <> 'owner'
  );

-- ========== الفترات المالية ==========
drop policy if exists periods_select on public.accounting_periods;
create policy periods_select on public.accounting_periods
  for select using (public.has_permission(company_id, 'periods.read'));

drop policy if exists periods_write on public.accounting_periods;
drop policy if exists periods_insert on public.accounting_periods;
create policy periods_insert on public.accounting_periods
  for insert with check (public.has_permission(company_id, 'periods.close'));

drop policy if exists periods_update on public.accounting_periods;
create policy periods_update on public.accounting_periods
  for update using (
    public.has_permission(company_id, 'periods.close')
    or public.has_permission(company_id, 'periods.reopen')
  )
  with check (
    public.has_permission(company_id, 'periods.close')
    or public.has_permission(company_id, 'periods.reopen')
  );

drop policy if exists periods_delete on public.accounting_periods;

-- ========== دليل الحسابات ==========
drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts
  for select using (public.has_permission(company_id, 'accounts.read'));

drop policy if exists accounts_write on public.accounts;
create policy accounts_insert on public.accounts
  for insert with check (public.has_permission(company_id, 'accounts.manage'));
create policy accounts_update on public.accounts
  for update using (public.has_permission(company_id, 'accounts.manage'))
  with check (public.has_permission(company_id, 'accounts.manage'));
create policy accounts_delete on public.accounts
  for delete using (public.has_permission(company_id, 'accounts.manage'));

-- ========== القيود اليومية ==========
drop policy if exists entries_select on public.journal_entries;
create policy entries_select on public.journal_entries
  for select using (public.has_permission(company_id, 'journal.read'));

drop policy if exists entries_insert on public.journal_entries;
create policy entries_insert on public.journal_entries
  for insert with check (public.has_permission(company_id, 'journal.create'));

drop policy if exists entries_update on public.journal_entries;
create policy entries_update on public.journal_entries
  for update using (
    public.has_permission(company_id, 'journal.edit_draft')
    or public.has_permission(company_id, 'journal.submit')
    or public.has_permission(company_id, 'journal.approve')
    or public.has_permission(company_id, 'journal.post')
    or public.has_permission(company_id, 'journal.reverse')
  )
  with check (
    public.has_permission(company_id, 'journal.edit_draft')
    or public.has_permission(company_id, 'journal.submit')
    or public.has_permission(company_id, 'journal.approve')
    or public.has_permission(company_id, 'journal.post')
    or public.has_permission(company_id, 'journal.reverse')
  );

drop policy if exists entries_delete on public.journal_entries;
create policy entries_delete on public.journal_entries
  for delete using (public.has_permission(company_id, 'journal.reverse'));

drop policy if exists lines_select on public.journal_entry_lines;
create policy lines_select on public.journal_entry_lines
  for select using (public.has_permission(company_id, 'journal.read'));

drop policy if exists lines_write on public.journal_entry_lines;
create policy lines_insert on public.journal_entry_lines
  for insert with check (public.has_permission(company_id, 'journal.create'));
create policy lines_update on public.journal_entry_lines
  for update using (
    public.has_permission(company_id, 'journal.edit_draft')
    or public.has_permission(company_id, 'journal.submit')
  )
  with check (
    public.has_permission(company_id, 'journal.edit_draft')
    or public.has_permission(company_id, 'journal.submit')
  );
create policy lines_delete on public.journal_entry_lines
  for delete using (public.has_permission(company_id, 'journal.edit_draft'));

-- ========== الاستيراد والملفات ==========
drop policy if exists files_select on public.uploaded_files;
create policy files_select on public.uploaded_files
  for select using (public.has_permission(company_id, 'imports.read'));

drop policy if exists files_insert on public.uploaded_files;
create policy files_insert on public.uploaded_files
  for insert with check (public.has_permission(company_id, 'imports.create'));

drop policy if exists batches_select on public.import_batches;
create policy batches_select on public.import_batches
  for select using (public.has_permission(company_id, 'imports.read'));

drop policy if exists batches_write on public.import_batches;
create policy batches_insert on public.import_batches
  for insert with check (public.has_permission(company_id, 'imports.create'));
create policy batches_update on public.import_batches
  for update using (public.has_permission(company_id, 'imports.create'))
  with check (public.has_permission(company_id, 'imports.create'));

drop policy if exists records_select on public.imported_records;
create policy records_select on public.imported_records
  for select using (public.has_permission(company_id, 'imports.read'));

drop policy if exists records_insert on public.imported_records;
create policy records_insert on public.imported_records
  for insert with check (public.has_permission(company_id, 'imports.create'));

-- ========== الاكتشافات والتقارير ==========
drop policy if exists findings_select on public.audit_findings;
create policy findings_select on public.audit_findings
  for select using (public.has_permission(company_id, 'findings.view'));

drop policy if exists findings_write on public.audit_findings;
create policy findings_insert on public.audit_findings
  for insert with check (public.has_permission(company_id, 'findings.review'));
create policy findings_update on public.audit_findings
  for update using (public.has_permission(company_id, 'findings.review'))
  with check (public.has_permission(company_id, 'findings.review'));

drop policy if exists duplicates_select on public.duplicate_findings;
create policy duplicates_select on public.duplicate_findings
  for select using (public.has_permission(company_id, 'findings.view'));

drop policy if exists duplicates_write on public.duplicate_findings;
create policy duplicates_insert on public.duplicate_findings
  for insert with check (
    public.has_permission(company_id, 'findings.review')
    and not public.has_company_role(company_id, array['auditor'])
  );
create policy duplicates_update on public.duplicate_findings
  for update using (
    public.has_permission(company_id, 'findings.review')
    and not public.has_company_role(company_id, array['auditor'])
  )
  with check (
    public.has_permission(company_id, 'findings.review')
    and not public.has_company_role(company_id, array['auditor'])
  );

drop policy if exists reports_select on public.financial_reports;
create policy reports_select on public.financial_reports
  for select using (public.has_permission(company_id, 'reports.view'));

drop policy if exists reports_write on public.financial_reports;
create policy reports_insert on public.financial_reports
  for insert with check (public.has_permission(company_id, 'reports.export'));
create policy reports_update on public.financial_reports
  for update using (public.has_permission(company_id, 'reports.export'))
  with check (public.has_permission(company_id, 'reports.export'));

drop policy if exists analysis_select on public.analysis_results;
create policy analysis_select on public.analysis_results
  for select using (public.has_permission(company_id, 'reports.view'));

drop policy if exists analysis_write on public.analysis_results;
create policy analysis_insert on public.analysis_results
  for insert with check (public.has_permission(company_id, 'reports.export'));
create policy analysis_update on public.analysis_results
  for update using (public.has_permission(company_id, 'reports.export'))
  with check (public.has_permission(company_id, 'reports.export'));

-- ========== سجلات النشاط والتدقيق ==========
drop policy if exists logs_select on public.activity_logs;
create policy logs_select on public.activity_logs
  for select using (company_id is null or public.has_permission(company_id, 'company.read'));

drop policy if exists logs_insert on public.activity_logs;
create policy logs_insert on public.activity_logs
  for insert with check (
    user_id = auth.uid() and (company_id is null or public.has_permission(company_id, 'company.read'))
  );

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert with check (
    user_id = auth.uid() and public.has_permission(company_id, 'company.read')
  );

-- ========== التخزين ==========
drop policy if exists company_files_select on storage.objects;
create policy company_files_select on storage.objects
  for select using (
    bucket_id = 'company-files'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'imports.read')
  );

drop policy if exists company_files_insert on storage.objects;
create policy company_files_insert on storage.objects
  for insert with check (
    bucket_id = 'company-files'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'imports.create')
  );

drop policy if exists company_files_delete on storage.objects;
create policy company_files_delete on storage.objects
  for delete using (
    bucket_id = 'company-files'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'imports.create')
  );

-- ========== الأدوار المخصصة (كانت تُقرأ بعضويتك فقط في 0004) ==========
-- عضو بدور مخصص يجب أن يقرأ دوره وصلاحياته ليُبنى سياقه في التطبيق،
-- حتى لو لم يملك company.members.read. الدالة security definer لتفادي تكرار فحص RLS.
create or replace function public.is_my_role(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members m
    where m.custom_role_id = target and m.user_id = auth.uid()
  );
$$;
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select using (
    is_system
    or public.is_my_role(id)
    or public.has_permission(company_id, 'company.members.read')
    or public.has_permission(company_id, 'company.roles.manage')
  );

drop policy if exists roles_write on public.roles;
create policy roles_insert on public.roles
  for insert with check (
    not is_system and public.has_permission(company_id, 'company.roles.manage')
  );
create policy roles_update on public.roles
  for update using (not is_system and public.has_permission(company_id, 'company.roles.manage'))
  with check (not is_system and public.has_permission(company_id, 'company.roles.manage'));
create policy roles_delete on public.roles
  for delete using (not is_system and public.has_permission(company_id, 'company.roles.manage'));

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select using (
    exists (
      select 1 from public.roles r
      where r.id = role_id
        and (
          r.is_system
          or public.is_my_role(r.id)
          or public.has_permission(r.company_id, 'company.members.read')
          or public.has_permission(r.company_id, 'company.roles.manage')
        )
    )
  );

drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_insert on public.role_permissions
  for insert with check (
    exists (
      select 1 from public.roles r
      where r.id = role_id
        and not r.is_system
        and public.has_permission(r.company_id, 'company.roles.manage')
    )
  );
create policy role_permissions_update on public.role_permissions
  for update using (
    exists (
      select 1 from public.roles r
      where r.id = role_id
        and not r.is_system
        and public.has_permission(r.company_id, 'company.roles.manage')
    )
  )
  with check (
    exists (
      select 1 from public.roles r
      where r.id = role_id
        and not r.is_system
        and public.has_permission(r.company_id, 'company.roles.manage')
    )
  );
create policy role_permissions_delete on public.role_permissions
  for delete using (
    exists (
      select 1 from public.roles r
      where r.id = role_id
        and not r.is_system
        and public.has_permission(r.company_id, 'company.roles.manage')
    )
  );

drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select using (
    user_id = auth.uid() or public.has_permission(company_id, 'company.members.read')
  );

drop policy if exists user_roles_write on public.user_roles;
create policy user_roles_insert on public.user_roles
  for insert with check (public.has_permission(company_id, 'company.members.manage'));
create policy user_roles_update on public.user_roles
  for update using (public.has_permission(company_id, 'company.members.manage'))
  with check (public.has_permission(company_id, 'company.members.manage'));
create policy user_roles_delete on public.user_roles
  for delete using (public.has_permission(company_id, 'company.members.manage'));
