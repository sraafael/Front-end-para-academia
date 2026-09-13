-- ═══════════════════════════════════════════════════════════════════════════
-- Visibilidade administrativa de alunos e professores
-- Pode ser executada mais de uma vez no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── Identificação segura do administrador ─────────────────────────────────

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

-- ── Ativação da segurança por linha ────────────────────────────────────

alter table public.alunos enable row level security;
alter table public.professores enable row level security;

-- Remove políticas antigas que filtravam silenciosamente os dados do admin.
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

-- ── Administrador: acesso total ────────────────────────────────────────

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

-- ── Professor: perfil próprio e alunos vinculados ──────────────────────────

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

-- ── Aluno: somente o próprio perfil ─────────────────────────────────────

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
