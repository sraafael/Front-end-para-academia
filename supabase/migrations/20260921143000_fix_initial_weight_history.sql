-- Corrige as regras antigas do histórico de peso, recupera pesos iniciais que
-- ficaram apenas no perfil do aluno e evita duplicidade ao atualizar no mesmo dia.

begin;

alter table public.historico_peso enable row level security;
grant select, insert, update, delete on table public.historico_peso to authenticated;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'historico_peso'
  loop
    execute format(
      'drop policy if exists %I on public.historico_peso',
      policy_row.policyname
    );
  end loop;
end
$$;

create policy "historico_peso: admin all"
on public.historico_peso for all to authenticated
using (public.is_fitpro_admin())
with check (public.is_fitpro_admin());

create policy "historico_peso: own all"
on public.historico_peso for all to authenticated
using (
  exists (
    select 1
    from public.alunos
    where alunos.id = historico_peso.aluno_id
      and alunos.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.alunos
    where alunos.id = historico_peso.aluno_id
      and alunos.user_id = auth.uid()
  )
);

create or replace function public.registrar_peso(
  p_aluno_id uuid,
  p_peso numeric,
  p_data date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_data date := coalesce(p_data, current_date);
begin
  if p_peso <= 0 then
    raise exception 'O peso deve ser maior que zero';
  end if;

  update public.alunos
  set peso = p_peso
  where id = p_aluno_id;

  if not found then
    raise exception 'Aluno não encontrado ou acesso negado' using errcode = '42501';
  end if;

  update public.historico_peso
  set peso = p_peso
  where aluno_id = p_aluno_id
    and data = v_data;

  if not found then
    insert into public.historico_peso (aluno_id, data, peso)
    values (p_aluno_id, v_data, p_peso);
  end if;
end;
$$;

revoke all on function public.registrar_peso(uuid, numeric, date) from public, anon;
grant execute on function public.registrar_peso(uuid, numeric, date) to authenticated;

insert into public.historico_peso (aluno_id, data, peso)
select
  alunos.id,
  coalesce(alunos.matricula_data, current_date),
  alunos.peso
from public.alunos
where alunos.peso > 0
  and not exists (
    select 1
    from public.historico_peso
    where historico_peso.aluno_id = alunos.id
  );

notify pgrst, 'reload schema';

commit;
