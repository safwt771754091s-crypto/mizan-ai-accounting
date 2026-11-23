-- 0006_proposals.sql
-- مركز المقترحات: تقديم أعضاء الشركة لمقترحات التطوير، فرزها، وربطها بـ Issue على GitHub.
-- إضافي بالكامل: جدول جديد فقط، ويعتمد على دوال الصلاحيات في 0004.

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null check (char_length(title) between 4 and 140),
  body text not null check (char_length(body) between 20 and 4000),
  category text not null default 'other'
    check (category in ('workflow', 'report', 'import', 'ux', 'other')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  status text not null default 'new'
    check (status in ('new', 'under_review', 'accepted', 'rejected', 'shipped')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decision_note text,
  issue_number integer,
  issue_url text
);

create index if not exists proposals_company_status_idx
  on public.proposals (company_id, status, created_at desc);

alter table public.proposals enable row level security;

drop policy if exists proposals_select on public.proposals;
create policy proposals_select on public.proposals
  for select using (public.has_permission(company_id, 'proposals.view'));

-- التقديم: من يملك proposals.create، ويُسجَّل باسمه هو
drop policy if exists proposals_insert on public.proposals;
create policy proposals_insert on public.proposals
  for insert with check (
    public.has_permission(company_id, 'proposals.create')
    and created_by = auth.uid()
  );

-- الفرز وتغيير الحالة: proposals.triage فقط
drop policy if exists proposals_update on public.proposals;
create policy proposals_update on public.proposals
  for update using (public.has_permission(company_id, 'proposals.triage'))
  with check (public.has_permission(company_id, 'proposals.triage'));

-- لا حذف: المقترح يبقى أثراً للمراجعة
revoke delete on public.proposals from authenticated;
revoke delete on public.proposals from anon;
