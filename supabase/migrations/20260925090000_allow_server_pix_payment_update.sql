-- O webhook confirmado usa a chave de serviço para quitar a mensalidade.
-- Alunos continuam impedidos de alterar os campos financeiros do próprio perfil.
create or replace function public._trg_alunos_update_restrict()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_fitpro_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if new.user_id is distinct from old.user_id then raise exception 'Not allowed to update user_id'; end if;
  if new.academy_id is distinct from old.academy_id then raise exception 'Not allowed to update academy_id'; end if;
  if new.professor_id is distinct from old.professor_id then raise exception 'Not allowed to update professor_id'; end if;
  if new.plano_id is distinct from old.plano_id then raise exception 'Not allowed to update plano_id'; end if;
  if new.status is distinct from old.status then raise exception 'Not allowed to update status'; end if;
  if new.forma_pagamento is distinct from old.forma_pagamento then raise exception 'Not allowed to update forma_pagamento'; end if;
  if new.pagamento_status is distinct from old.pagamento_status then raise exception 'Not allowed to update pagamento_status'; end if;
  if new.vencimento is distinct from old.vencimento then raise exception 'Not allowed to update vencimento'; end if;

  return new;
end;
$$;
