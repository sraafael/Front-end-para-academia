-- Remove políticas antigas e mantém somente os acessos usados pela aplicação.

begin;

-- Esta função antiga permitia criar usuários sem passar pelos fluxos protegidos.
drop function if exists public.admin_create_user(text, text, text);

-- Funções de trigger não precisam ser executadas diretamente pelos usuários.
revoke all on function public.capture_fitpro_audit() from public, anon, authenticated;
revoke all on function public._trg_alunos_update_restrict() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_aluno_turma_membership() from public, anon, authenticated;
revoke all on function public.validate_fitpro_academy_links() from public, anon, authenticated;
revoke all on function public.discard_incomplete_member_account(uuid, text) from public, anon, authenticated;

-- Estas funções existem apenas em algumas instalações antigas.
do $$
begin
  if to_regprocedure('public._trg_professores_update_restrict()') is not null then
    execute 'revoke all on function public._trg_professores_update_restrict() from public, anon, authenticated';
  end if;
  if to_regprocedure('public.handle_new_user()') is not null then
    execute 'alter function public.handle_new_user() set search_path = public, auth';
  end if;
  if to_regprocedure('public.touch_treino_updated_at()') is not null then
    execute 'alter function public.touch_treino_updated_at() set search_path = public';
  end if;
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
  if to_regprocedure('public._is_admin()') is not null then
    execute 'revoke all on function public._is_admin() from public, anon, authenticated';
  end if;
end;
$$;

-- O privilégio de proprietário depende do cadastro ativo, não de um token antigo.
create or replace function public.is_fitpro_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_admins
    where user_id = auth.uid()
      and is_owner = true
      and status = 'ativo'
  );
$$;

revoke all on function public.is_fitpro_owner() from public, anon;
grant execute on function public.is_fitpro_owner() to authenticated;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename::text = any(array[
        'academies', 'academy_admins', 'audit_logs', 'planos', 'professores',
        'alunos', 'turmas', 'transacoes', 'historico_peso', 'frequencia',
        'treinos', 'exercicios', 'series_realizadas'
      ])
  loop
    execute format('drop policy if exists %I on public.%I', v_policy.policyname, v_policy.tablename);
  end loop;
end;
$$;

alter table public.academies enable row level security;
alter table public.academy_admins enable row level security;
alter table public.audit_logs enable row level security;
alter table public.planos enable row level security;
alter table public.professores enable row level security;
alter table public.alunos enable row level security;
alter table public.turmas enable row level security;
alter table public.transacoes enable row level security;
alter table public.historico_peso enable row level security;
alter table public.frequencia enable row level security;
alter table public.treinos enable row level security;
alter table public.exercicios enable row level security;
alter table public.series_realizadas enable row level security;

-- Proprietário e administração.
create policy "academies: permitted read"
on public.academies for select to authenticated
using (public.is_fitpro_owner() or id = public.current_fitpro_academy_id());

create policy "academies: owner write"
on public.academies for all to authenticated
using (public.is_fitpro_owner())
with check (public.is_fitpro_owner());

create policy "academy_admins: own read"
on public.academy_admins for select to authenticated
using (user_id = auth.uid());

create policy "academy_admins: owner all"
on public.academy_admins for all to authenticated
using (public.is_fitpro_owner())
with check (public.is_fitpro_owner());

create policy "audit_logs: owner read"
on public.audit_logs for select to authenticated
using (public.is_fitpro_owner());

-- Planos podem ser consultados pelos membros da unidade e alterados pela administração.
create policy "planos: academy read"
on public.planos for select to authenticated
using (public.can_access_fitpro_academy(academy_id));

create policy "planos: academy admin insert"
on public.planos for insert to authenticated
with check (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id));

create policy "planos: academy admin update"
on public.planos for update to authenticated
using (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id))
with check (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id));

create policy "planos: academy admin delete"
on public.planos for delete to authenticated
using (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id));

create policy "professores: academy admin all"
on public.professores for all to authenticated
using (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id))
with check (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id));

create policy "professores: own read"
on public.professores for select to authenticated
using (user_id = auth.uid());

create policy "alunos: academy admin all"
on public.alunos for all to authenticated
using (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id))
with check (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id));

create policy "alunos: assigned professor read"
on public.alunos for select to authenticated
using (exists (
  select 1 from public.professores professor
  where professor.user_id = auth.uid()
    and professor.status <> 'inativo'
    and professor.id = alunos.professor_id
));

create policy "alunos: own read"
on public.alunos for select to authenticated
using (user_id = auth.uid());

-- Aulas ficam visíveis apenas para a administração, professor responsável e matriculados.
create policy "turmas: academy admin all"
on public.turmas for all to authenticated
using (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id))
with check (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id));

create policy "turmas: assigned professor read"
on public.turmas for select to authenticated
using (exists (
  select 1 from public.professores professor
  where professor.user_id = auth.uid()
    and professor.status <> 'inativo'
    and professor.id = turmas.professor_id
));

create policy "turmas: enrolled student read"
on public.turmas for select to authenticated
using (exists (
  select 1 from public.alunos aluno
  where aluno.user_id = auth.uid()
    and aluno.status <> 'inativo'
    and aluno.id = any(turmas.aluno_ids)
));

create policy "transacoes: academy admin all"
on public.transacoes for all to authenticated
using (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id))
with check (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id));

create policy "transacoes: student own read"
on public.transacoes for select to authenticated
using (exists (
  select 1 from public.alunos aluno
  where aluno.id = transacoes.aluno_id and aluno.user_id = auth.uid()
));

create policy "historico_peso: academy admin all"
on public.historico_peso for all to authenticated
using (public.is_fitpro_admin() and exists (
  select 1 from public.alunos aluno
  where aluno.id = historico_peso.aluno_id
    and public.can_access_fitpro_academy(aluno.academy_id)
))
with check (public.is_fitpro_admin() and exists (
  select 1 from public.alunos aluno
  where aluno.id = historico_peso.aluno_id
    and public.can_access_fitpro_academy(aluno.academy_id)
));

create policy "historico_peso: student own read"
on public.historico_peso for select to authenticated
using (exists (
  select 1 from public.alunos aluno
  where aluno.id = historico_peso.aluno_id and aluno.user_id = auth.uid()
));

create policy "frequencia: academy admin all"
on public.frequencia for all to authenticated
using (public.is_fitpro_admin() and exists (
  select 1 from public.alunos aluno
  where aluno.id = frequencia.aluno_id
    and public.can_access_fitpro_academy(aluno.academy_id)
))
with check (public.is_fitpro_admin() and exists (
  select 1 from public.alunos aluno
  where aluno.id = frequencia.aluno_id
    and public.can_access_fitpro_academy(aluno.academy_id)
));

create policy "frequencia: assigned professor all"
on public.frequencia for all to authenticated
using (exists (
  select 1 from public.alunos aluno
  join public.professores professor on professor.id = aluno.professor_id
  where aluno.id = frequencia.aluno_id
    and professor.user_id = auth.uid() and professor.status <> 'inativo'
))
with check (exists (
  select 1 from public.alunos aluno
  join public.professores professor on professor.id = aluno.professor_id
  where aluno.id = frequencia.aluno_id
    and professor.user_id = auth.uid() and professor.status <> 'inativo'
));

create policy "frequencia: student own read"
on public.frequencia for select to authenticated
using (exists (
  select 1 from public.alunos aluno
  where aluno.id = frequencia.aluno_id and aluno.user_id = auth.uid()
));

create policy "treinos: academy admin all"
on public.treinos for all to authenticated
using (public.is_fitpro_admin() and exists (
  select 1 from public.alunos aluno
  where aluno.id = treinos.aluno_id
    and public.can_access_fitpro_academy(aluno.academy_id)
))
with check (public.is_fitpro_admin() and exists (
  select 1 from public.alunos aluno
  where aluno.id = treinos.aluno_id
    and public.can_access_fitpro_academy(aluno.academy_id)
));

create policy "treinos: assigned professor all"
on public.treinos for all to authenticated
using (exists (
  select 1 from public.alunos aluno
  join public.professores professor on professor.id = aluno.professor_id
  where aluno.id = treinos.aluno_id
    and professor.user_id = auth.uid() and professor.status <> 'inativo'
))
with check (exists (
  select 1 from public.alunos aluno
  join public.professores professor on professor.id = aluno.professor_id
  where aluno.id = treinos.aluno_id
    and professor.user_id = auth.uid() and professor.status <> 'inativo'
));

create policy "treinos: student own read"
on public.treinos for select to authenticated
using (exists (
  select 1 from public.alunos aluno
  where aluno.id = treinos.aluno_id and aluno.user_id = auth.uid()
));

create policy "exercicios: academy admin all"
on public.exercicios for all to authenticated
using (public.is_fitpro_admin() and exists (
  select 1 from public.treinos treino
  join public.alunos aluno on aluno.id = treino.aluno_id
  where treino.id = exercicios.treino_id
    and public.can_access_fitpro_academy(aluno.academy_id)
))
with check (public.is_fitpro_admin() and exists (
  select 1 from public.treinos treino
  join public.alunos aluno on aluno.id = treino.aluno_id
  where treino.id = exercicios.treino_id
    and public.can_access_fitpro_academy(aluno.academy_id)
));

create policy "exercicios: assigned professor all"
on public.exercicios for all to authenticated
using (exists (
  select 1 from public.treinos treino
  join public.alunos aluno on aluno.id = treino.aluno_id
  join public.professores professor on professor.id = aluno.professor_id
  where treino.id = exercicios.treino_id
    and professor.user_id = auth.uid() and professor.status <> 'inativo'
))
with check (exists (
  select 1 from public.treinos treino
  join public.alunos aluno on aluno.id = treino.aluno_id
  join public.professores professor on professor.id = aluno.professor_id
  where treino.id = exercicios.treino_id
    and professor.user_id = auth.uid() and professor.status <> 'inativo'
));

create policy "exercicios: student own read"
on public.exercicios for select to authenticated
using (exists (
  select 1 from public.treinos treino
  join public.alunos aluno on aluno.id = treino.aluno_id
  where treino.id = exercicios.treino_id and aluno.user_id = auth.uid()
));

create policy "series: academy admin all"
on public.series_realizadas for all to authenticated
using (public.is_fitpro_admin() and exists (
  select 1 from public.exercicios exercicio
  join public.treinos treino on treino.id = exercicio.treino_id
  join public.alunos aluno on aluno.id = treino.aluno_id
  where exercicio.id = series_realizadas.exercicio_id
    and public.can_access_fitpro_academy(aluno.academy_id)
))
with check (public.is_fitpro_admin() and exists (
  select 1 from public.exercicios exercicio
  join public.treinos treino on treino.id = exercicio.treino_id
  join public.alunos aluno on aluno.id = treino.aluno_id
  where exercicio.id = series_realizadas.exercicio_id
    and public.can_access_fitpro_academy(aluno.academy_id)
));

create policy "series: assigned professor all"
on public.series_realizadas for all to authenticated
using (exists (
  select 1 from public.exercicios exercicio
  join public.treinos treino on treino.id = exercicio.treino_id
  join public.alunos aluno on aluno.id = treino.aluno_id
  join public.professores professor on professor.id = aluno.professor_id
  where exercicio.id = series_realizadas.exercicio_id
    and professor.user_id = auth.uid() and professor.status <> 'inativo'
))
with check (exists (
  select 1 from public.exercicios exercicio
  join public.treinos treino on treino.id = exercicio.treino_id
  join public.alunos aluno on aluno.id = treino.aluno_id
  join public.professores professor on professor.id = aluno.professor_id
  where exercicio.id = series_realizadas.exercicio_id
    and professor.user_id = auth.uid() and professor.status <> 'inativo'
));

create policy "series: student own read"
on public.series_realizadas for select to authenticated
using (exists (
  select 1 from public.exercicios exercicio
  join public.treinos treino on treino.id = exercicio.treino_id
  join public.alunos aluno on aluno.id = treino.aluno_id
  where exercicio.id = series_realizadas.exercicio_id and aluno.user_id = auth.uid()
));

create policy "series: student own insert"
on public.series_realizadas for insert to authenticated
with check (exists (
  select 1 from public.exercicios exercicio
  join public.treinos treino on treino.id = exercicio.treino_id
  join public.alunos aluno on aluno.id = treino.aluno_id
  where exercicio.id = series_realizadas.exercicio_id and aluno.user_id = auth.uid()
));

create policy "series: student own update"
on public.series_realizadas for update to authenticated
using (exists (
  select 1 from public.exercicios exercicio
  join public.treinos treino on treino.id = exercicio.treino_id
  join public.alunos aluno on aluno.id = treino.aluno_id
  where exercicio.id = series_realizadas.exercicio_id and aluno.user_id = auth.uid()
))
with check (exists (
  select 1 from public.exercicios exercicio
  join public.treinos treino on treino.id = exercicio.treino_id
  join public.alunos aluno on aluno.id = treino.aluno_id
  where exercicio.id = series_realizadas.exercicio_id and aluno.user_id = auth.uid()
));

-- A atualização do peso ocorre em uma única operação e mantém o histórico consistente.
create or replace function public.registrar_peso(
  p_aluno_id uuid,
  p_peso numeric,
  p_data date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data date := coalesce(p_data, current_date);
  v_user_id uuid;
  v_academy_id uuid;
  v_is_admin boolean := public.is_fitpro_admin();
begin
  if auth.uid() is null then raise exception 'Sessão inválida' using errcode = '42501'; end if;
  if p_peso is null or p_peso <= 0 then raise exception 'O peso deve ser maior que zero'; end if;

  select user_id, academy_id into v_user_id, v_academy_id
  from public.alunos where id = p_aluno_id for update;
  if not found then raise exception 'Aluno não encontrado' using errcode = '42501'; end if;
  if auth.uid() <> v_user_id and not (v_is_admin and public.can_access_fitpro_academy(v_academy_id)) then
    raise exception 'Aluno não encontrado ou acesso negado' using errcode = '42501';
  end if;
  if not v_is_admin and v_data <> current_date then
    raise exception 'O aluno só pode registrar o peso atual' using errcode = '42501';
  end if;

  update public.alunos set peso = p_peso where id = p_aluno_id;
  insert into public.historico_peso (aluno_id, data, peso)
  values (p_aluno_id, v_data, p_peso)
  on conflict (aluno_id, data) do update set peso = excluded.peso;
end;
$$;

revoke all on function public.registrar_peso(uuid, numeric, date) from public, anon;
grant execute on function public.registrar_peso(uuid, numeric, date) to authenticated;

notify pgrst, 'reload schema';

commit;
