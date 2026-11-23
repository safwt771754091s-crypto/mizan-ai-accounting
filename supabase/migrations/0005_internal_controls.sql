-- 0005_internal_controls.sql
-- رقابة داخلية: دورة حياة القيد (إرسال/اعتماد/ترحيل)، وسجل تدقيق غير قابل للتعديل.
-- إضافي بالكامل: لا يحذف أعمدة ولا يغيّر بيانات قائمة.

-- 1) توسيع حالات القيد لتشمل مسار الاعتماد
alter table public.journal_entries
  drop constraint if exists journal_entries_status_check;

alter table public.journal_entries
  add constraint journal_entries_status_check
  check (status in ('draft', 'submitted', 'approved', 'rejected', 'posted', 'void'));

-- 2) طوابع دورة الحياة: من أرسل، من اعتمد، من رحّل، من رفض
alter table public.journal_entries
  add column if not exists submitted_by uuid references auth.users (id),
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_by uuid references auth.users (id),
  add column if not exists approved_at timestamptz,
  add column if not exists posted_by uuid references auth.users (id),
  add column if not exists posted_at timestamptz,
  add column if not exists rejected_by uuid references auth.users (id),
  add column if not exists rejected_at timestamptz,
  add column if not exists review_note text;

create index if not exists journal_entries_status_idx
  on public.journal_entries (company_id, status);

-- 3) سجل التدقيق: إلحاقي فقط (لا تحديث ولا حذف لأي عضو)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  action text not null,
  entity text not null,
  entity_id text,
  from_status text,
  to_status text,
  note text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_company_time_idx
  on public.audit_logs (company_id, created_at desc);

alter table public.audit_logs enable row level security;

-- القراءة لمن يملك audit.view داخل الشركة (الدور النظامي أو دور مخصص)
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select using (public.has_permission(company_id, 'audit.view'));

-- الإلحاق لعضو الشركة فقط، ومربوط بالمستخدم الحالي حتى لا يُنتحل سجل باسم غيره
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert with check (
    public.is_company_member(company_id)
    and user_id = auth.uid()
  );

-- لا سياسات تحديث أو حذف: السجل غير قابل للتعديل من التطبيق.
revoke update, delete on public.audit_logs from authenticated;
revoke update, delete on public.audit_logs from anon;
