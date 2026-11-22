-- RAKAZ AI — 0001: الملفات الشخصية والشركات ودليل الحسابات
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null default 'user' check (role in ('user', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  activity_type text,
  country text not null default 'SA',
  currency text not null default 'SAR',
  fiscal_year_start date not null,
  fiscal_year_end date not null,
  entity_type text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  tax_number text,
  registration_number text,
  phone text,
  email text,
  city text,
  address text,
  notes text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_fiscal_year check (fiscal_year_end >= fiscal_year_start)
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'accountant', 'auditor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists company_members_user_idx on public.company_members (user_id);

create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'open' check (status in ('open', 'closed', 'locked')),
  created_at timestamptz not null default now(),
  unique (company_id, start_date, end_date)
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  name text not null,
  name_en text,
  type text not null check (type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  subtype text not null default 'other_asset',
  parent_id uuid references public.accounts (id) on delete set null,
  is_contra boolean not null default false,
  is_active boolean not null default true,
  opening_balance numeric(20, 4) not null default 0,
  opening_balance_type text check (opening_balance_type in ('debit', 'credit')),
  currency text,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create index if not exists accounts_company_type_idx on public.accounts (company_id, type);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_touch on public.companies;
create trigger companies_touch before update on public.companies
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- إضافة منشئ الشركة كمالك تلقائياً (يتجاوز RLS بأمان)
create or replace function public.add_company_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.company_members (company_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (company_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists companies_add_owner on public.companies;
create trigger companies_add_owner
  after insert on public.companies
  for each row execute function public.add_company_owner();

-- منع ترقية الدور الذاتي إلى مدير المنصة
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'تغيير دور الحساب غير مسموح من هذه الواجهة';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();
