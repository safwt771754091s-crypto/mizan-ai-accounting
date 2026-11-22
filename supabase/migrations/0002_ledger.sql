-- Mizan AI — 0002: القيود والملفات والاستيراد ونتائج التحليل
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  period_id uuid references public.accounting_periods (id) on delete set null,
  entry_number text not null,
  entry_date date not null,
  description text not null,
  reference text,
  source text not null default 'manual',
  status text not null default 'posted' check (status in ('draft', 'posted', 'void')),
  currency text not null default 'SAR',
  exchange_rate numeric(20, 8) default 1,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (company_id, entry_number)
);

create index if not exists journal_entries_company_date_idx on public.journal_entries (company_id, entry_date);

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  account_code text not null,
  debit numeric(20, 4) not null default 0 check (debit >= 0),
  credit numeric(20, 4) not null default 0 check (credit >= 0),
  description text,
  cost_center text,
  branch text,
  document_ref text,
  created_at timestamptz not null default now(),
  constraint lines_not_both check (not (debit > 0 and credit > 0))
);

create index if not exists lines_entry_idx on public.journal_entry_lines (entry_id);
create index if not exists lines_company_account_idx on public.journal_entry_lines (company_id, account_code);

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  file_kind text not null check (file_kind in ('xlsx', 'xls', 'csv', 'pdf')),
  size_bytes bigint not null,
  checksum text not null,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  file_id uuid references public.uploaded_files (id) on delete set null,
  file_name text not null,
  file_kind text not null,
  size_bytes bigint not null,
  checksum text not null,
  dataset text not null,
  sheet_name text,
  mapping jsonb not null default '{}'::jsonb,
  row_count integer not null default 0,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  warning_count integer not null default 0,
  status text not null default 'completed' check (status in ('completed', 'partial', 'failed')),
  issues jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (company_id, checksum, dataset)
);

create table if not exists public.imported_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  batch_id uuid not null references public.import_batches (id) on delete cascade,
  dataset text not null,
  row_number integer not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists imported_records_batch_idx on public.imported_records (batch_id);

create table if not exists public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  finding_key text not null,
  code text,
  title text,
  severity text check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  note text,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, finding_key)
);

create table if not exists public.duplicate_findings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  group_key text not null,
  kind text,
  strength text check (strength in ('strong', 'medium', 'weak')),
  score numeric(5, 2),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (company_id, group_key)
);

create table if not exists public.financial_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  kind text not null default 'full',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  period_start date,
  period_end date,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  user_id uuid references auth.users (id),
  action text not null,
  entity text not null,
  entity_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_company_idx on public.activity_logs (company_id, created_at desc);
