-- Permite que a administração emita uma nova senha temporária para professores.

begin;

create or replace function public.reset_professor_password(
  p_professor_id uuid,
  p_temporary_password text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid;
  v_status public.professor_status;
begin
  if not public.is_fitpro_admin() then
    raise exception 'Apenas a administração pode redefinir senhas de professores';
  end if;

  if length(coalesce(p_temporary_password, '')) < 12 then
    raise exception 'A senha temporária deve possuir pelo menos 12 caracteres';
  end if;

  select user_id, status
  into v_user_id, v_status
  from public.professores
  where id = p_professor_id
  for update;

  if not found then
    raise exception 'Professor não encontrado';
  end if;

  if v_user_id is null then
    raise exception 'Conta de acesso do professor não encontrada';
  end if;

  if v_status = 'inativo' then
    raise exception 'Reative o professor antes de redefinir a senha';
  end if;

  update auth.users
  set encrypted_password = crypt(p_temporary_password, gen_salt('bf')),
      updated_at = now()
  where id = v_user_id;

  if not found then
    raise exception 'Conta de acesso do professor não encontrada';
  end if;

  delete from auth.sessions where user_id = v_user_id;

  update public.professores
  set is_first_login = true
  where id = p_professor_id;
end;
$$;

revoke all on function public.reset_professor_password(uuid, text) from public, anon;
grant execute on function public.reset_professor_password(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
