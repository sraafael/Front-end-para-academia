-- Mantém a criação de administradores e as redefinições de senha apenas no servidor.

begin;

create or replace function public.create_fitpro_academy_admin_profile(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_academy_id uuid,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_cpf text := regexp_replace(coalesce(p_profile ->> 'cpf', ''), '[^0-9]', '', 'g');
  v_nome text := trim(coalesce(p_profile ->> 'nome', ''));
  v_expected_email text;
  v_actual_email text;
  v_admin public.academy_admins;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Operação permitida apenas ao servidor' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.academy_admins
    where user_id = p_actor_user_id and is_owner and status = 'ativo'
  ) then
    raise exception 'Apenas o proprietário ativo pode cadastrar administradores' using errcode = '42501';
  end if;
  if not exists (select 1 from public.academies where id = p_academy_id) then
    raise exception 'Academia não encontrada';
  end if;
  if v_nome = '' then raise exception 'Informe o nome do administrador'; end if;
  if v_cpf !~ '^[0-9]{11}$' then raise exception 'CPF inválido'; end if;

  v_expected_email := 'admin.' || v_cpf || '@fitpro.internal';
  select lower(email) into v_actual_email from auth.users where id = p_user_id;
  if v_actual_email is null or v_actual_email <> v_expected_email then
    raise exception 'A conta de acesso não corresponde ao CPF informado';
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'admin', 'is_owner', false, 'academy_id', p_academy_id),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'admin', 'cpf', v_cpf, 'nome', v_nome),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = p_user_id;

  insert into public.academy_admins (
    academy_id, user_id, nome, cpf, telefone, email, cargo,
    status, is_owner, is_first_login
  ) values (
    p_academy_id,
    p_user_id,
    v_nome,
    v_cpf,
    coalesce(p_profile ->> 'telefone', ''),
    trim(coalesce(p_profile ->> 'email', '')),
    coalesce(nullif(trim(p_profile ->> 'cargo'), ''), 'Administrador'),
    'ativo',
    false,
    true
  )
  returning * into v_admin;

  return to_jsonb(v_admin);
end;
$$;

create or replace function public.reset_fitpro_access_password(
  p_actor_user_id uuid,
  p_target_role text,
  p_target_id uuid,
  p_temporary_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_actor_is_owner boolean;
  v_actor_academy_id uuid;
  v_target_user_id uuid;
  v_target_academy_id uuid;
  v_target_status text;
  v_target_is_owner boolean;
  v_admin public.academy_admins;
  v_professor public.professores;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Operação permitida apenas ao servidor' using errcode = '42501';
  end if;
  if length(coalesce(p_temporary_password, '')) < 16 then
    raise exception 'A senha temporária deve possuir pelo menos 16 caracteres';
  end if;

  select is_owner, academy_id
  into v_actor_is_owner, v_actor_academy_id
  from public.academy_admins
  where user_id = p_actor_user_id and status = 'ativo';

  if not found then
    raise exception 'Apenas a administração ativa pode redefinir senhas' using errcode = '42501';
  end if;

  if p_target_role = 'admin' then
    if not v_actor_is_owner then
      raise exception 'Apenas o proprietário pode redefinir senhas de administradores' using errcode = '42501';
    end if;

    select user_id, status, is_owner
    into v_target_user_id, v_target_status, v_target_is_owner
    from public.academy_admins
    where id = p_target_id
    for update;

    if not found then raise exception 'Administrador não encontrado'; end if;
    if v_target_is_owner then raise exception 'A senha do proprietário não pode ser redefinida por este painel'; end if;
    if v_target_status <> 'ativo' then raise exception 'Ative o administrador antes de redefinir a senha'; end if;

    update auth.users
    set encrypted_password = crypt(p_temporary_password, gen_salt('bf')), updated_at = now()
    where id = v_target_user_id;
    if not found then raise exception 'Conta de acesso do administrador não encontrada'; end if;

    delete from auth.sessions where user_id = v_target_user_id;
    update public.academy_admins
    set is_first_login = true, updated_at = now()
    where id = p_target_id
    returning * into v_admin;
    return to_jsonb(v_admin);
  end if;

  if p_target_role = 'professor' then
    select user_id, academy_id, status
    into v_target_user_id, v_target_academy_id, v_target_status
    from public.professores
    where id = p_target_id
    for update;

    if not found then raise exception 'Professor não encontrado'; end if;
    if not v_actor_is_owner and v_target_academy_id is distinct from v_actor_academy_id then
      raise exception 'Professor não encontrado ou acesso negado' using errcode = '42501';
    end if;
    if v_target_status = 'inativo' then raise exception 'Reative o professor antes de redefinir a senha'; end if;
    if v_target_user_id is null then raise exception 'Conta de acesso do professor não encontrada'; end if;

    update auth.users
    set encrypted_password = crypt(p_temporary_password, gen_salt('bf')), updated_at = now()
    where id = v_target_user_id;
    if not found then raise exception 'Conta de acesso do professor não encontrada'; end if;

    delete from auth.sessions where user_id = v_target_user_id;
    update public.professores
    set is_first_login = true
    where id = p_target_id
    returning * into v_professor;
    return to_jsonb(v_professor);
  end if;

  raise exception 'Perfil inválido';
end;
$$;

revoke all on function public.create_fitpro_academy_admin_profile(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_fitpro_academy_admin_profile(uuid, uuid, uuid, jsonb) to service_role;

revoke all on function public.reset_fitpro_access_password(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.reset_fitpro_access_password(uuid, text, uuid, text) to service_role;

-- Os fluxos antigos deixaram de aceitar senhas geradas pelo navegador.
revoke execute on function public.complete_academy_admin_registration(uuid, text, text, text, text, text, uuid) from authenticated;
revoke execute on function public.reset_professor_password(uuid, text) from authenticated;
revoke execute on function public.reset_academy_admin_password(uuid, text) from authenticated;

notify pgrst, 'reload schema';

commit;
