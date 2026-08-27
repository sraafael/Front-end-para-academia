-- Fix FitPro admin visibility without depending on a public.profiles table.
-- Safe to run more than once in the Supabase SQL Editor.

begin;

create or replace function public.is_fitpro_admin()
returns boolean
language sql
stable
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false)
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fitpro.internal';
$$;

revoke all on function public.is_fitpro_admin() from public;
grant execute on function public.is_fitpro_admin() to authenticated;

alter table public.alunos enable row level security;
alter table public.professores enable row level security;

-- Remove every old policy from these two tables. The deployed project had
-- several policies that silently filtered all rows for the administrator.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('alunos', 'professores')
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  end loop;
end
$$;

grant select, insert, update, delete on table public.alunos to authenticated;
grant select, insert, update, delete on table public.professores to authenticated;

-- Administrator: full management access.
create policy "alunos: admin all"
on public.alunos
for all
to authenticated
using (public.is_fitpro_admin())
with check (public.is_fitpro_admin());

create policy "professores: admin all"
on public.professores
for all
to authenticated
using (public.is_fitpro_admin())
with check (public.is_fitpro_admin());

-- Professor: own profile and only students assigned to that profile.
create policy "professores: own read"
on public.professores
for select
to authenticated
using (user_id = auth.uid());

create policy "alunos: assigned professor read"
on public.alunos
for select
to authenticated
using (
  exists (
    select 1
    from public.professores as professor
    where professor.user_id = auth.uid()
      and professor.id = alunos.professor_id
  )
);

-- Student: own profile only.
create policy "alunos: own read"
on public.alunos
for select
to authenticated
using (user_id = auth.uid());

create policy "alunos: own update"
on public.alunos
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

commit;
