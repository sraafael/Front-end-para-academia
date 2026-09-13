-- Corrige as operações administrativas bloqueadas por permissões, registra o
-- período de férias e mantém a matrícula aluno/turma consistente.

begin;

alter table public.professores
  add column if not exists ferias_inicio date,
  add column if not exists ferias_fim date;

alter table public.professores
  drop constraint if exists professores_ferias_periodo_check;
alter table public.professores
  add constraint professores_ferias_periodo_check check (
    (ferias_inicio is null and ferias_fim is null)
    or (ferias_inicio is not null and ferias_fim is not null and ferias_fim >= ferias_inicio)
  );

create or replace function public.is_fitpro_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false)
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role' = 'admin', false)
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fitpro.internal'
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'email', '')) = 'admin@fitpro.internal';
$$;

revoke all on function public.is_fitpro_admin() from public;
grant execute on function public.is_fitpro_admin() to authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.alunos,
  public.professores,
  public.planos,
  public.turmas,
  public.transacoes,
  public.historico_peso,
  public.frequencia,
  public.treinos,
  public.exercicios,
  public.series_realizadas
to authenticated;

drop policy if exists "turmas: admin write" on public.turmas;
create policy "turmas: admin write"
on public.turmas for all to authenticated
using (public.is_fitpro_admin())
with check (public.is_fitpro_admin());

drop policy if exists "transacoes: admin all" on public.transacoes;
create policy "transacoes: admin all"
on public.transacoes for all to authenticated
using (public.is_fitpro_admin())
with check (public.is_fitpro_admin());

drop policy if exists "professores: admin all" on public.professores;
create policy "professores: admin all"
on public.professores for all to authenticated
using (public.is_fitpro_admin())
with check (public.is_fitpro_admin());

create or replace function public.sync_aluno_turma_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacidade integer;
  v_ocupacao integer;
begin
  if tg_op = 'DELETE' then
    update public.turmas
    set aluno_ids = array_remove(aluno_ids, old.id)
    where old.id = any(aluno_ids);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.turma_id is not distinct from new.turma_id then
    return new;
  end if;

  update public.turmas
  set aluno_ids = array_remove(aluno_ids, new.id)
  where new.id = any(aluno_ids);

  if new.turma_id is not null then
    select capacidade, cardinality(aluno_ids)
    into v_capacidade, v_ocupacao
    from public.turmas
    where id = new.turma_id
    for update;

    if not found then
      raise exception 'Turma não encontrada';
    end if;
    if v_ocupacao >= v_capacidade then
      raise exception 'A turma atingiu a capacidade máxima';
    end if;

    update public.turmas
    set aluno_ids = array_append(aluno_ids, new.id)
    where id = new.turma_id;
  end if;

  return new;
end;
$$;

drop trigger if exists alunos_sync_turma on public.alunos;
create trigger alunos_sync_turma
after insert or update or delete on public.alunos
for each row execute function public.sync_aluno_turma_membership();

commit;
