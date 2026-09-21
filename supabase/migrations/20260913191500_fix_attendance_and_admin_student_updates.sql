-- Corrige duas falhas encontradas nos testes reais do fluxo professor/admin:
-- a chamada precisava de uma chave unica para o upsert, e o gatilho legado
-- ainda consultava a antiga funcao de administrador.

begin;

with duplicadas as (
  select
    id,
    row_number() over (
      partition by aluno_id, data
      order by id desc
    ) as posicao
  from public.frequencia
)
delete from public.frequencia
where id in (select id from duplicadas where posicao > 1);

alter table public.frequencia
  drop constraint if exists frequencia_aluno_id_data_key;
alter table public.frequencia
  add constraint frequencia_aluno_id_data_key unique (aluno_id, data);

create or replace function public._trg_alunos_update_restrict()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_fitpro_admin() then
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'Not allowed to update user_id';
  end if;
  if new.professor_id is distinct from old.professor_id then
    raise exception 'Not allowed to update professor_id';
  end if;
  if new.plano_id is distinct from old.plano_id then
    raise exception 'Not allowed to update plano_id';
  end if;
  if new.status is distinct from old.status then
    raise exception 'Not allowed to update status';
  end if;
  if new.forma_pagamento is distinct from old.forma_pagamento then
    raise exception 'Not allowed to update forma_pagamento';
  end if;
  if new.pagamento_status is distinct from old.pagamento_status then
    raise exception 'Not allowed to update pagamento_status';
  end if;
  if new.vencimento is distinct from old.vencimento then
    raise exception 'Not allowed to update vencimento';
  end if;

  return new;
end;
$$;

create or replace function public.complete_first_login_profile(
  p_role text,
  p_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role = 'professor' then
    update public.professores
    set is_first_login = false
    where id = p_entity_id and user_id = auth.uid();
  elsif p_role = 'aluno' then
    update public.alunos
    set is_first_login = false
    where id = p_entity_id and user_id = auth.uid();
  elsif p_role in ('admin', 'owner') then
    update public.academy_admins
    set is_first_login = false
    where id = p_entity_id and user_id = auth.uid();
  else
    raise exception 'Perfil de acesso inválido';
  end if;

  if not found then
    raise exception 'Perfil não encontrado ou acesso negado' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.complete_first_login_profile(text, uuid) from public, anon;
grant execute on function public.complete_first_login_profile(text, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
