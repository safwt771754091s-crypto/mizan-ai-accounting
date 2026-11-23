-- rls_permissions.sql — اختبار تكامل لعزل الشركات وسياسات الصلاحيات.
-- يُشغَّل داخل مشروع Supabase حقيقي (SQL Editor أو psql بمستخدم postgres)، ثم يُرجع كل شيء (rollback).
-- الغرض: إثبات أن RLS بعد الترحيل 0007 تمنع تسريب بيانات شركة إلى أخرى، وتحترم الأدوار المخصصة.
-- المتوقع في النهاية: كل السطور PASSED بلا أي استثناء.

begin;

-- ===== 1) بيانات اختبار معزولة (معرّفات ثابتة لا تتعارض مع بيانات حقيقية) =====
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000000a', 'rls.owner.a@example.test', 'x', now(), '{"full_name":"مالك أ"}', now(), now()),
  ('00000000-0000-4000-8000-00000000000b', 'rls.viewer.a@example.test', 'x', now(), '{"full_name":"مشاهد أ"}', now(), now()),
  ('00000000-0000-4000-8000-00000000000c', 'rls.owner.b@example.test', 'x', now(), '{"full_name":"مالك ب"}', now(), now()),
  ('00000000-0000-4000-8000-00000000000d', 'rls.custom.a@example.test', 'x', now(), '{"full_name":"دور مخصص"}', now(), now())
on conflict (id) do nothing;

insert into public.companies (id, name, fiscal_year_start, fiscal_year_end, created_by)
values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'شركة اختبار أ', '2025-01-01', '2025-12-31', '00000000-0000-4000-8000-00000000000a'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'شركة اختبار ب', '2025-01-01', '2025-12-31', '00000000-0000-4000-8000-00000000000c')
on conflict (id) do nothing;

insert into public.company_members (company_id, user_id, role)
values
  ('aaaaaaaa-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'owner'),
  ('aaaaaaaa-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b', 'viewer'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000c', 'owner')
on conflict (company_id, user_id) do nothing;

-- دور مخصص يملك reports.view فقط، لإثبات أن RLS تقرأ الصلاحيات لا اسم الدور
insert into public.roles (id, company_id, name, description, is_system, created_by)
values ('cccccccc-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-00000000000a', 'قارئ تقارير', 'اختبار RLS', false, '00000000-0000-4000-8000-00000000000a')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission)
values ('cccccccc-0000-4000-8000-00000000000c', 'reports.view')
on conflict do nothing;

insert into public.company_members (company_id, user_id, role, custom_role_id)
values ('aaaaaaaa-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000d', 'viewer', 'cccccccc-0000-4000-8000-00000000000c')
on conflict (company_id, user_id) do nothing;

insert into public.journal_entries (company_id, entry_number, entry_date, description, created_by)
values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'RLS-A-1', '2025-03-01', 'قيد شركة أ', '00000000-0000-4000-8000-00000000000a'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'RLS-B-1', '2025-03-01', 'قيد شركة ب', '00000000-0000-4000-8000-00000000000c')
on conflict (company_id, entry_number) do nothing;

insert into public.accounting_periods (id, company_id, name, start_date, end_date, status)
values ('dddddddd-0000-4000-8000-00000000000d', 'aaaaaaaa-0000-4000-8000-00000000000a', 'فترة اختبار', '2025-01-01', '2025-12-31', 'open')
on conflict (id) do nothing;

-- ===== 2) مالك الشركة أ: يرى بيانات شركته فقط =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from public.journal_entries;
  if n <> 1 then raise exception 'FAIL: مالك أ يرى % قيداً بدل 1 (تسريب بين الشركات)', n; end if;
  raise notice 'PASS: مالك أ يرى قيود شركته فقط';

  select count(*) into n from public.journal_entries where company_id = 'bbbbbbbb-0000-4000-8000-00000000000b';
  if n <> 0 then raise exception 'FAIL: مالك أ يرى % قيداً من شركة أخرى', n; end if;
  raise notice 'PASS: لا تسريب إلى شركة ب';

  select count(*) into n from public.companies;
  if n <> 1 then raise exception 'FAIL: مالك أ يرى % شركة بدل 1', n; end if;
  raise notice 'PASS: قائمة الشركات معزولة';

  if not public.has_permission('aaaaaaaa-0000-4000-8000-00000000000a', 'journal.post') then
    raise exception 'FAIL: المالك لا يملك journal.post';
  end if;
  raise notice 'PASS: has_permission تعمل للمالك';
end $$;
reset role;

-- ===== 3) المشاهد: يقرأ ولا يكتب =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from public.journal_entries;
  if n <> 1 then raise exception 'FAIL: المشاهد لا يرى قيود شركته (% بدل 1)', n; end if;
  raise notice 'PASS: المشاهد يقرأ قيود شركته';

  select count(*) into n from public.company_members;
  if n <> 1 then raise exception 'FAIL: المشاهد يرى % عضوية بدل صفّه فقط', n; end if;
  raise notice 'PASS: العضو يقرأ عضويته ولا يرى بقية الأعضاء';

  begin
    insert into public.journal_entries (company_id, entry_number, entry_date, description)
    values ('aaaaaaaa-0000-4000-8000-00000000000a', 'RLS-A-HACK', '2025-03-02', 'محاولة كتابة');
    raise exception 'FAIL: المشاهد نجح في إنشاء قيد';
  exception
    when insufficient_privilege then raise notice 'PASS: منع المشاهد من إنشاء قيد';
    when check_violation then raise notice 'PASS: منع المشاهد من إنشاء قيد';
  end;

  begin
    delete from public.accounting_periods where id = 'dddddddd-0000-4000-8000-00000000000d';
    if found then raise exception 'FAIL: المشاهد حذف فترة مالية'; end if;
    raise notice 'PASS: حذف الفترة غير مسموح (لا سياسة حذف)';
  exception
    when insufficient_privilege then raise notice 'PASS: منع المشاهد من حذف الفترة';
  end;
end $$;
reset role;

-- ===== 4) الدور المخصص: RLS تقرأ الصلاحية لا اسم الدور =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);

do $$
declare n int;
begin
  if not public.has_permission('aaaaaaaa-0000-4000-8000-00000000000a', 'reports.view') then
    raise exception 'FAIL: الدور المخصص لم يُمنح reports.view';
  end if;
  raise notice 'PASS: الدور المخصص يملك reports.view';

  if public.has_permission('aaaaaaaa-0000-4000-8000-00000000000a', 'accounts.read') then
    raise exception 'FAIL: الدور المخصص حصل على accounts.read دون منحه';
  end if;
  raise notice 'PASS: الدور المخصص لا يملك صلاحيات غير ممنوحة';

  select count(*) into n from public.journal_entries;
  if n <> 0 then raise exception 'FAIL: الدور المخصص (بلا journal.read) يرى % قيداً', n; end if;
  raise notice 'PASS: RLS تحجب القيود عن دور بلا journal.read';

  select count(*) into n from public.roles where id = 'cccccccc-0000-4000-8000-00000000000c';
  if n <> 1 then raise exception 'FAIL: صاحب الدور المخصص لا يقرأ دوره'; end if;
  select count(*) into n from public.role_permissions where role_id = 'cccccccc-0000-4000-8000-00000000000c';
  if n <> 1 then raise exception 'FAIL: صاحب الدور المخصص لا يقرأ صلاحياته'; end if;
  raise notice 'PASS: صاحب الدور المخصص يقرأ دوره وصلاحياته';
end $$;
reset role;

-- ===== 5) منع الوصول عبر تغيير معرّف الشركة في الطلب =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from public.accounts where company_id = 'bbbbbbbb-0000-4000-8000-00000000000b';
  if n <> 0 then raise exception 'FAIL: وصول إلى دليل حسابات شركة أخرى'; end if;
  raise notice 'PASS: معرّف شركة غير مصرّح به يعيد صفر صفوف';
end $$;
reset role;

do $$ begin raise notice 'ALL RLS CHECKS PASSED'; end $$;

rollback;
