-- RAKAZ AI — 0004: نظام الصلاحيات المؤسسي (RBAC) والأدوار المخصصة
-- إضافي بالكامل: لا يعدّل جداول 0001–0003 ولا يحذف سياساتها.
-- كتالوج الصلاحيات هنا يجب أن يطابق src/lib/auth/permission-catalog.ts
-- (يوجد اختبار يحرس هذا التطابق: src/tests/permissions.test.ts).

-- 1) دور "محاسب أول" + ربط العضو بدور مخصص
alter table public.company_members drop constraint if exists company_members_role_check;
alter table public.company_members
  add constraint company_members_role_check
  check (role in ('owner', 'admin', 'senior_accountant', 'accountant', 'auditor', 'viewer'));

-- 2) جدول الأدوار: أدوار نظامية (company_id = null) وأدوار مخصصة داخل شركة
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  key text,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint roles_system_has_no_company check (
    (is_system and company_id is null and key is not null)
    or (not is_system and company_id is not null)
  )
);

create unique index if not exists roles_system_key_idx on public.roles (key) where is_system;
create unique index if not exists roles_company_name_idx on public.roles (company_id, name) where not is_system;
create index if not exists roles_company_idx on public.roles (company_id);

alter table public.company_members
  add column if not exists custom_role_id uuid references public.roles (id) on delete set null;
create index if not exists company_members_custom_role_idx on public.company_members (custom_role_id);

-- 3) صلاحيات كل دور
create table if not exists public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission text not null,
  primary key (role_id, permission)
);

-- 4) إسناد أدوار المنصة (متعدد الأدوار، ونطاق فرع اختياري)
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  branch_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, role_id, company_id)
);
create index if not exists user_roles_user_idx on public.user_roles (user_id);

-- 5) بذور الأدوار النظامية (مطابقة لمصفوفة ROLE_PERMISSIONS في الكود)
insert into public.roles (key, name, description, is_system)
values
  ('owner', 'مالك', 'كل صلاحيات الشركة', true),
  ('admin', 'مدير', 'إدارة العمليات والمستخدمين', true),
  ('senior_accountant', 'محاسب أول', 'إدخال وترحيل القيود', true),
  ('accountant', 'محاسب', 'إدخال القيود والاستيراد', true),
  ('auditor', 'مراجع', 'قراءة ومراجعة دون تعديل', true),
  ('viewer', 'مشاهد', 'قراءة فقط', true)
on conflict (key) where is_system do nothing;

insert into public.role_permissions (role_id, permission)
select r.id, unnest(
  case r.key
    when 'owner' then array[
      'company.read','company.settings.manage','company.members.read','company.members.manage',
      'company.roles.manage','company.branches.manage','accounts.read','accounts.manage',
      'journal.read','journal.create','journal.edit_draft','journal.submit','journal.approve',
      'journal.post','journal.reverse','journal.export','imports.read','imports.create',
      'periods.read','periods.close','periods.reopen','reports.view','reports.export',
      'findings.view','findings.review','audit.view','proposals.create','proposals.view','proposals.triage'
    ]
    when 'admin' then array[
      'company.read','company.settings.manage','company.members.read','company.members.manage',
      'company.branches.manage','accounts.read','accounts.manage',
      'journal.read','journal.create','journal.edit_draft','journal.submit','journal.approve',
      'journal.post','journal.reverse','journal.export','imports.read','imports.create',
      'periods.read','periods.close','reports.view','reports.export',
      'findings.view','findings.review','audit.view','proposals.create','proposals.view','proposals.triage'
    ]
    when 'senior_accountant' then array[
      'company.read','company.members.read','accounts.read','accounts.manage',
      'journal.read','journal.create','journal.edit_draft','journal.submit','journal.post','journal.export',
      'imports.read','imports.create','periods.read','reports.view','reports.export',
      'findings.view','audit.view','proposals.create','proposals.view'
    ]
    when 'accountant' then array[
      'company.read','accounts.read','journal.read','journal.create','journal.edit_draft',
      'journal.submit','journal.export','imports.read','imports.create','periods.read',
      'reports.view','findings.view','proposals.create','proposals.view'
    ]
    when 'auditor' then array[
      'company.read','company.members.read','accounts.read','journal.read','imports.read',
      'periods.read','reports.view','findings.view','findings.review','audit.view',
      'proposals.create','proposals.view'
    ]
    when 'viewer' then array[
      'company.read','accounts.read','journal.read','periods.read','reports.view','findings.view'
    ]
  end
)
from public.roles r
where r.is_system
on conflict do nothing;

-- 5ب) أدوار المنصة (لا تمنح أي صلاحية على دفاتر العملاء)
insert into public.roles (key, name, description, is_system)
values
  ('super_admin', 'مدير المنصة الأعلى', 'إدارة كاملة للمنصة دون تعديل دفاتر العملاء', true),
  ('platform_admin', 'مدير منصة', 'إدارة محددة للمنصة', true)
on conflict (key) where is_system do nothing;

insert into public.role_permissions (role_id, permission)
select r.id, unnest(
  case r.key
    when 'super_admin' then array[
      'platform.users.read','platform.users.manage','platform.companies.read','platform.companies.manage',
      'platform.settings.manage','platform.audit.view','platform.proposals.manage','platform.stats.view'
    ]
    when 'platform_admin' then array[
      'platform.users.read','platform.companies.read','platform.audit.view',
      'platform.proposals.manage','platform.stats.view'
    ]
  end
)
from public.roles r
where r.is_system and r.key in ('super_admin', 'platform_admin')
on conflict do nothing;

-- 6) دالة التحقق المركزية في قاعدة البيانات
-- ملاحظة أمنية: مدير المنصة لا يحصل تلقائياً على صلاحيات الشركات؛
-- أي وصول استثنائي يتطلب عضوية صريحة قابلة للتتبع.
create or replace function public.has_permission(target uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members m
    join public.roles r
      on r.id = m.custom_role_id
      or (m.custom_role_id is null and r.is_system and r.key = m.role)
    join public.role_permissions rp on rp.role_id = r.id
    where m.company_id = target
      and m.user_id = auth.uid()
      and rp.permission = perm
  );
$$;

-- 7) سياسات RLS للجداول الجديدة
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select using (is_system or public.is_company_member(company_id));

drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles
  for all using (not is_system and public.has_permission(company_id, 'company.roles.manage'))
  with check (not is_system and public.has_permission(company_id, 'company.roles.manage'));

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select using (
    exists (
      select 1 from public.roles r
      where r.id = role_id and (r.is_system or public.is_company_member(r.company_id))
    )
  );

drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions
  for all using (
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

drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select using (
    user_id = auth.uid() or public.has_permission(company_id, 'company.members.manage')
  );

drop policy if exists user_roles_write on public.user_roles;
create policy user_roles_write on public.user_roles
  for all using (public.has_permission(company_id, 'company.members.manage'))
  with check (public.has_permission(company_id, 'company.members.manage'));

-- 8) منع تعيين دور مخصص لشركة أخرى (حماية على مستوى القيد)
create or replace function public.company_members_custom_role_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_company uuid;
begin
  if new.custom_role_id is not null then
    select company_id into role_company from public.roles where id = new.custom_role_id;
    if role_company is null or role_company <> new.company_id then
      raise exception 'الدور المخصص لا ينتمي إلى هذه الشركة';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists company_members_custom_role_guard on public.company_members;
create trigger company_members_custom_role_guard
  before insert or update of custom_role_id on public.company_members
  for each row execute function public.company_members_custom_role_guard();
