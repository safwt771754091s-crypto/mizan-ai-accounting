-- RAKAZ AI — 0003: دوال الصلاحيات وسياسات RLS والتخزين
create or replace function public.is_company_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = target and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_company_role(target uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = target and m.user_id = auth.uid() and m.role = any(roles)
  );
$$;

create or replace function public.is_company_creator(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.companies c where c.id = target and c.created_by = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.accounting_periods enable row level security;
alter table public.accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.import_batches enable row level security;
alter table public.imported_records enable row level security;
alter table public.audit_findings enable row level security;
alter table public.duplicate_findings enable row level security;
alter table public.financial_reports enable row level security;
alter table public.analysis_results enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.company_members me
      join public.company_members other on other.company_id = me.company_id
      where me.user_id = auth.uid() and other.user_id = profiles.id
    )
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select using (public.is_company_member(id) or created_by = auth.uid());

drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies
  for insert with check (created_by = auth.uid());

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
  for update using (public.has_company_role(id, array['owner', 'admin', 'accountant']))
  with check (public.has_company_role(id, array['owner', 'admin', 'accountant']));

drop policy if exists members_select on public.company_members;
create policy members_select on public.company_members
  for select using (public.is_company_member(company_id));

drop policy if exists members_insert on public.company_members;
create policy members_insert on public.company_members
  for insert with check (
    (user_id = auth.uid() and role = 'owner' and public.is_company_creator(company_id))
    or public.has_company_role(company_id, array['owner', 'admin'])
  );

drop policy if exists members_update on public.company_members;
create policy members_update on public.company_members
  for update using (public.has_company_role(company_id, array['owner', 'admin']))
  with check (public.has_company_role(company_id, array['owner', 'admin']));

drop policy if exists members_delete on public.company_members;
create policy members_delete on public.company_members
  for delete using (public.has_company_role(company_id, array['owner', 'admin']) and role <> 'owner');

drop policy if exists periods_select on public.accounting_periods;
create policy periods_select on public.accounting_periods
  for select using (public.is_company_member(company_id));

drop policy if exists periods_write on public.accounting_periods;
create policy periods_write on public.accounting_periods
  for all using (public.has_company_role(company_id, array['owner', 'admin', 'accountant']))
  with check (public.has_company_role(company_id, array['owner', 'admin', 'accountant']));

drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts
  for select using (public.is_company_member(company_id));

drop policy if exists accounts_write on public.accounts;
create policy accounts_write on public.accounts
  for all using (public.has_company_role(company_id, array['owner', 'admin', 'accountant']))
  with check (public.has_company_role(company_id, array['owner', 'admin', 'accountant']));

drop policy if exists entries_select on public.journal_entries;
create policy entries_select on public.journal_entries
  for select using (public.is_company_member(company_id));

drop policy if exists entries_insert on public.journal_entries;
create policy entries_insert on public.journal_entries
  for insert with check (public.has_company_role(company_id, array['owner', 'admin', 'accountant']));

drop policy if exists entries_update on public.journal_entries;
create policy entries_update on public.journal_entries
  for update using (public.has_company_role(company_id, array['owner', 'admin', 'accountant']))
  with check (public.has_company_role(company_id, array['owner', 'admin', 'accountant']));

drop policy if exists entries_delete on public.journal_entries;
create policy entries_delete on public.journal_entries
  for delete using (public.has_company_role(company_id, array['owner', 'admin']));

drop policy if exists lines_select on public.journal_entry_lines;
create policy lines_select on public.journal_entry_lines
  for select using (public.is_company_member(company_id));

drop policy if exists lines_write on public.journal_entry_lines;
create policy lines_write on public.journal_entry_lines
  for all using (public.has_company_role(company_id, array['owner', 'admin', 'accountant']))
  with check (public.has_company_role(company_id, array['owner', 'admin', 'accountant']));

drop policy if exists files_select on public.uploaded_files;
create policy files_select on public.uploaded_files
  for select using (public.is_company_member(company_id));

drop policy if exists files_insert on public.uploaded_files;
create policy files_insert on public.uploaded_files
  for insert with check (public.has_company_role(company_id, array['owner', 'admin', 'accountant']));

drop policy if exists batches_select on public.import_batches;
create policy batches_select on public.import_batches
  for select using (public.is_company_member(company_id));

drop policy if exists batches_write on public.import_batches;
create policy batches_write on public.import_batches
  for all using (public.has_company_role(company_id, array['owner', 'admin', 'accountant']))
  with check (public.has_company_role(company_id, array['owner', 'admin', 'accountant']));

drop policy if exists records_select on public.imported_records;
create policy records_select on public.imported_records
  for select using (public.is_company_member(company_id));

drop policy if exists records_insert on public.imported_records;
create policy records_insert on public.imported_records
  for insert with check (public.has_company_role(company_id, array['owner', 'admin', 'accountant']));

drop policy if exists findings_select on public.audit_findings;
create policy findings_select on public.audit_findings
  for select using (public.is_company_member(company_id));

drop policy if exists findings_write on public.audit_findings;
create policy findings_write on public.audit_findings
  for all using (public.has_company_role(company_id, array['owner', 'admin', 'accountant', 'auditor']))
  with check (public.has_company_role(company_id, array['owner', 'admin', 'accountant', 'auditor']));

drop policy if exists duplicates_select on public.duplicate_findings;
create policy duplicates_select on public.duplicate_findings
  for select using (public.is_company_member(company_id));

drop policy if exists duplicates_write on public.duplicate_findings;
create policy duplicates_write on public.duplicate_findings
  for all using (public.has_company_role(company_id, array['owner', 'admin', 'accountant']))
  with check (public.has_company_role(company_id, array['owner', 'admin', 'accountant']));

drop policy if exists reports_select on public.financial_reports;
create policy reports_select on public.financial_reports
  for select using (public.is_company_member(company_id));

drop policy if exists reports_write on public.financial_reports;
create policy reports_write on public.financial_reports
  for all using (public.has_company_role(company_id, array['owner', 'admin', 'accountant']))
  with check (public.has_company_role(company_id, array['owner', 'admin', 'accountant']));

drop policy if exists analysis_select on public.analysis_results;
create policy analysis_select on public.analysis_results
  for select using (public.is_company_member(company_id));

drop policy if exists analysis_write on public.analysis_results;
create policy analysis_write on public.analysis_results
  for all using (public.has_company_role(company_id, array['owner', 'admin', 'accountant']))
  with check (public.has_company_role(company_id, array['owner', 'admin', 'accountant']));

drop policy if exists logs_select on public.activity_logs;
create policy logs_select on public.activity_logs
  for select using (company_id is null or public.is_company_member(company_id));

drop policy if exists logs_insert on public.activity_logs;
create policy logs_insert on public.activity_logs
  for insert with check (
    user_id = auth.uid() and (company_id is null or public.is_company_member(company_id))
  );

insert into storage.buckets (id, name, public)
values ('company-files', 'company-files', false)
on conflict (id) do nothing;

drop policy if exists company_files_select on storage.objects;
create policy company_files_select on storage.objects
  for select using (
    bucket_id = 'company-files'
    and public.is_company_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists company_files_insert on storage.objects;
create policy company_files_insert on storage.objects
  for insert with check (
    bucket_id = 'company-files'
    and public.has_company_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'accountant'])
  );

drop policy if exists company_files_delete on storage.objects;
create policy company_files_delete on storage.objects
  for delete using (
    bucket_id = 'company-files'
    and public.has_company_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin'])
  );
