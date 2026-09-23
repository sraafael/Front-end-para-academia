-- Registra o responsável por ações administrativas e evita contatos repetidos.

begin;

alter table public.audit_logs
  drop constraint if exists audit_logs_action_check;
alter table public.audit_logs
  add constraint audit_logs_action_check
  check (action in ('insert', 'update', 'delete', 'reset', 'seed', 'password_reset'));

create or replace function public.capture_fitpro_audit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row jsonb;
  v_id uuid;
  v_label text;
  v_actor_id uuid;
  v_actor_email text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_id := nullif(v_row ->> 'id', '')::uuid;
  v_label := coalesce(
    nullif(v_row ->> 'nome', ''),
    nullif(v_row ->> 'descricao', ''),
    nullif(v_row ->> 'categoria', '')
  );
  v_actor_id := coalesce(
    auth.uid(),
    nullif(current_setting('app.fitpro_actor_id', true), '')::uuid
  );

  select email into v_actor_email from auth.users where id = v_actor_id;

  insert into public.audit_logs (
    actor_id, actor_email, action, entity, entity_id, label, details
  ) values (
    v_actor_id,
    coalesce(v_actor_email, 'sistema'),
    lower(tg_op),
    tg_table_name,
    v_id,
    v_label,
    jsonb_build_object(
      'origem', case when auth.uid() is null then 'servidor' else 'aplicacao' end,
      'academy_id', v_row ->> 'academy_id'
    )
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.capture_fitpro_audit() from public, anon, authenticated;

-- Identifica o campo em conflito antes de criar uma conta no Auth.
create or replace function public.find_fitpro_registration_conflict(
  p_role text,
  p_academy_id uuid,
  p_cpf text,
  p_telefone text,
  p_email text,
  p_exclude_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  v_telefone text := regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g');
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if auth.role() <> 'service_role' then
    raise exception 'Operação permitida apenas ao servidor' using errcode = '42501';
  end if;

  if p_role = 'aluno' then
    if exists (select 1 from public.alunos where cpf = v_cpf and id is distinct from p_exclude_id) then return 'cpf'; end if;
    if v_telefone <> '' and exists (
      select 1 from public.alunos
      where academy_id = p_academy_id
        and regexp_replace(telefone, '[^0-9]', '', 'g') = v_telefone
        and id is distinct from p_exclude_id
    ) then return 'telefone'; end if;
    if v_email <> '' and exists (
      select 1 from public.alunos
      where academy_id = p_academy_id and lower(trim(email)) = v_email
        and id is distinct from p_exclude_id
    ) then return 'email'; end if;
  elsif p_role = 'professor' then
    if exists (select 1 from public.professores where cpf = v_cpf and id is distinct from p_exclude_id) then return 'cpf'; end if;
    if v_telefone <> '' and exists (
      select 1 from public.professores
      where academy_id = p_academy_id
        and regexp_replace(telefone, '[^0-9]', '', 'g') = v_telefone
        and id is distinct from p_exclude_id
    ) then return 'telefone'; end if;
    if v_email <> '' and exists (
      select 1 from public.professores
      where academy_id = p_academy_id and lower(trim(email)) = v_email
        and id is distinct from p_exclude_id
    ) then return 'email'; end if;
  elsif p_role = 'admin' then
    if exists (select 1 from public.academy_admins where cpf = v_cpf and id is distinct from p_exclude_id) then return 'cpf'; end if;
    if v_telefone <> '' and exists (
      select 1 from public.academy_admins
      where academy_id = p_academy_id
        and regexp_replace(telefone, '[^0-9]', '', 'g') = v_telefone
        and id is distinct from p_exclude_id
    ) then return 'telefone'; end if;
    if v_email <> '' and exists (
      select 1 from public.academy_admins
      where academy_id = p_academy_id and lower(trim(email)) = v_email
        and id is distinct from p_exclude_id
    ) then return 'email'; end if;
  else
    raise exception 'Perfil inválido';
  end if;

  return null;
end;
$$;

revoke all on function public.find_fitpro_registration_conflict(text, uuid, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.find_fitpro_registration_conflict(text, uuid, text, text, text, uuid)
  to service_role;

-- As regras consideram telefone sem máscara e e-mail sem diferença de maiúsculas.
create unique index if not exists alunos_academy_telefone_key
  on public.alunos (academy_id, regexp_replace(telefone, '[^0-9]', '', 'g'))
  where regexp_replace(telefone, '[^0-9]', '', 'g') <> '';
create unique index if not exists alunos_academy_email_key
  on public.alunos (academy_id, lower(trim(email)))
  where trim(email) <> '';
create unique index if not exists professores_academy_telefone_key
  on public.professores (academy_id, regexp_replace(telefone, '[^0-9]', '', 'g'))
  where regexp_replace(telefone, '[^0-9]', '', 'g') <> '';
create unique index if not exists professores_academy_email_key
  on public.professores (academy_id, lower(trim(email)))
  where trim(email) <> '';
create unique index if not exists academy_admins_academy_telefone_key
  on public.academy_admins (academy_id, regexp_replace(telefone, '[^0-9]', '', 'g'))
  where academy_id is not null and regexp_replace(telefone, '[^0-9]', '', 'g') <> '';
create unique index if not exists academy_admins_academy_email_key
  on public.academy_admins (academy_id, lower(trim(email)))
  where academy_id is not null and trim(email) <> '';

create or replace function public.create_fitpro_member_profile(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_role text,
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
  v_telefone text := regexp_replace(coalesce(p_profile ->> 'telefone', ''), '[^0-9]', '', 'g');
  v_email text := lower(trim(coalesce(p_profile ->> 'email', '')));
  v_plano_id uuid := nullif(p_profile ->> 'plano_id', '')::uuid;
  v_professor_id uuid := nullif(p_profile ->> 'professor_id', '')::uuid;
  v_turma_id uuid := nullif(p_profile ->> 'turma_id', '')::uuid;
  v_matricula_data date := coalesce(nullif(p_profile ->> 'matricula_data', '')::date, current_date);
  v_peso numeric := coalesce(nullif(p_profile ->> 'peso', '')::numeric, 0);
  v_expected_email text;
  v_actual_email text;
  v_conflict text;
  v_capacidade integer;
  v_ocupacao integer;
  v_aluno public.alunos;
  v_professor public.professores;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Operação permitida apenas ao servidor' using errcode = '42501';
  end if;
  if p_role not in ('aluno', 'professor') then raise exception 'Perfil inválido'; end if;
  if not exists (
    select 1 from public.academy_admins
    where user_id = p_actor_user_id and status = 'ativo' and academy_id = p_academy_id
  ) then
    raise exception 'A administração não possui acesso a esta academia' using errcode = '42501';
  end if;
  if v_nome = '' then raise exception 'Informe o nome'; end if;
  if v_cpf !~ '^[0-9]{11}$' then raise exception 'Informe um CPF válido'; end if;
  if not exists (select 1 from public.academies where id = p_academy_id) then raise exception 'Academia não encontrada'; end if;

  v_conflict := public.find_fitpro_registration_conflict(
    p_role, p_academy_id, v_cpf, v_telefone, v_email, null
  );
  if v_conflict = 'cpf' then raise exception 'Já existe um % cadastrado com este CPF', p_role; end if;
  if v_conflict = 'telefone' then raise exception 'Já existe um % cadastrado com este telefone', p_role; end if;
  if v_conflict = 'email' then raise exception 'Já existe um % cadastrado com este e-mail', p_role; end if;

  v_expected_email := p_role || '.' || v_cpf || '@fitpro.internal';
  select lower(email) into v_actual_email from auth.users where id = p_user_id;
  if v_actual_email is null or v_actual_email <> v_expected_email then
    raise exception 'A conta de acesso não corresponde ao CPF informado';
  end if;

  perform set_config('app.fitpro_actor_id', p_actor_user_id::text, true);
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', p_role, 'academy_id', p_academy_id),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', p_role, 'cpf', v_cpf, 'nome', v_nome),
      updated_at = now()
  where id = p_user_id;

  if p_role = 'professor' then
    insert into public.professores (
      id, user_id, academy_id, nome, cpf, telefone, email, horario,
      salario, especialidade, status, is_first_login
    ) values (
      p_user_id, p_user_id, p_academy_id, v_nome, v_cpf,
      coalesce(p_profile ->> 'telefone', ''), coalesce(p_profile ->> 'email', ''),
      coalesce(p_profile ->> 'horario', ''),
      coalesce(nullif(p_profile ->> 'salario', '')::numeric, 0),
      coalesce(p_profile ->> 'especialidade', ''),
      coalesce(nullif(p_profile ->> 'status', ''), 'ativo')::public.professor_status,
      true
    ) returning * into v_professor;
    return to_jsonb(v_professor);
  end if;

  if v_plano_id is not null and not exists (
    select 1 from public.planos where id = v_plano_id and academy_id = p_academy_id
  ) then raise exception 'O plano não pertence a esta academia'; end if;
  if v_professor_id is not null and not exists (
    select 1 from public.professores where id = v_professor_id and academy_id = p_academy_id
  ) then raise exception 'O professor não pertence a esta academia'; end if;
  if v_turma_id is not null then
    select capacidade, cardinality(aluno_ids) into v_capacidade, v_ocupacao
    from public.turmas where id = v_turma_id and academy_id = p_academy_id for update;
    if not found then raise exception 'A turma não pertence a esta academia'; end if;
    if v_ocupacao >= v_capacidade then raise exception 'A turma atingiu a capacidade máxima'; end if;
  end if;

  insert into public.alunos (
    id, user_id, academy_id, nome, cpf, telefone, email, idade, peso,
    plano_id, professor_id, status, turma_id, matricula_data,
    is_first_login, forma_pagamento, pagamento_status, vencimento
  ) values (
    p_user_id, p_user_id, p_academy_id, v_nome, v_cpf,
    coalesce(p_profile ->> 'telefone', ''), coalesce(p_profile ->> 'email', ''),
    coalesce(nullif(p_profile ->> 'idade', '')::integer, 0), v_peso,
    v_plano_id, v_professor_id,
    coalesce(nullif(p_profile ->> 'status', ''), 'ativo')::public.aluno_status,
    v_turma_id, v_matricula_data, true,
    coalesce(p_profile ->> 'forma_pagamento', ''), 'pendente',
    nullif(p_profile ->> 'vencimento', '')::date
  ) returning * into v_aluno;

  if v_turma_id is not null then
    update public.turmas
    set aluno_ids = case when p_user_id = any(aluno_ids) then aluno_ids else array_append(aluno_ids, p_user_id) end
    where id = v_turma_id;
  end if;
  if v_peso > 0 then
    insert into public.historico_peso (aluno_id, data, peso)
    values (p_user_id, v_matricula_data, v_peso) on conflict do nothing;
  end if;

  return to_jsonb(v_aluno);
end;
$$;

revoke all on function public.create_fitpro_member_profile(uuid, uuid, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_fitpro_member_profile(uuid, uuid, text, uuid, jsonb)
  to service_role;

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
  v_telefone text := regexp_replace(coalesce(p_profile ->> 'telefone', ''), '[^0-9]', '', 'g');
  v_email text := lower(trim(coalesce(p_profile ->> 'email', '')));
  v_expected_email text;
  v_actual_email text;
  v_conflict text;
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
  if not exists (select 1 from public.academies where id = p_academy_id) then raise exception 'Academia não encontrada'; end if;
  if v_nome = '' then raise exception 'Informe o nome do administrador'; end if;
  if v_cpf !~ '^[0-9]{11}$' then raise exception 'CPF inválido'; end if;

  v_conflict := public.find_fitpro_registration_conflict(
    'admin', p_academy_id, v_cpf, v_telefone, v_email, null
  );
  if v_conflict = 'cpf' then raise exception 'Já existe um administrador cadastrado com este CPF'; end if;
  if v_conflict = 'telefone' then raise exception 'Já existe um administrador cadastrado com este telefone'; end if;
  if v_conflict = 'email' then raise exception 'Já existe um administrador cadastrado com este e-mail'; end if;

  v_expected_email := 'admin.' || v_cpf || '@fitpro.internal';
  select lower(email) into v_actual_email from auth.users where id = p_user_id;
  if v_actual_email is null or v_actual_email <> v_expected_email then
    raise exception 'A conta de acesso não corresponde ao CPF informado';
  end if;

  perform set_config('app.fitpro_actor_id', p_actor_user_id::text, true);
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'admin', 'is_owner', false, 'academy_id', p_academy_id),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'admin', 'cpf', v_cpf, 'nome', v_nome),
      email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
  where id = p_user_id;

  insert into public.academy_admins (
    academy_id, user_id, nome, cpf, telefone, email, cargo,
    status, is_owner, is_first_login
  ) values (
    p_academy_id, p_user_id, v_nome, v_cpf,
    coalesce(p_profile ->> 'telefone', ''), trim(coalesce(p_profile ->> 'email', '')),
    coalesce(nullif(trim(p_profile ->> 'cargo'), ''), 'Administrador'),
    'ativo', false, true
  ) returning * into v_admin;

  return to_jsonb(v_admin);
end;
$$;

revoke all on function public.create_fitpro_academy_admin_profile(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_fitpro_academy_admin_profile(uuid, uuid, uuid, jsonb)
  to service_role;

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
  v_actor_email text;
  v_target_user_id uuid;
  v_target_academy_id uuid;
  v_target_status text;
  v_target_is_owner boolean;
  v_target_name text;
  v_admin public.academy_admins;
  v_professor public.professores;
begin
  if auth.role() <> 'service_role' then raise exception 'Operação permitida apenas ao servidor' using errcode = '42501'; end if;
  if length(coalesce(p_temporary_password, '')) < 16 then raise exception 'A senha temporária deve possuir pelo menos 16 caracteres'; end if;

  select is_owner, academy_id into v_actor_is_owner, v_actor_academy_id
  from public.academy_admins where user_id = p_actor_user_id and status = 'ativo';
  if not found then raise exception 'Apenas a administração ativa pode redefinir senhas' using errcode = '42501'; end if;
  select email into v_actor_email from auth.users where id = p_actor_user_id;
  perform set_config('app.fitpro_actor_id', p_actor_user_id::text, true);

  if p_target_role = 'admin' then
    if not v_actor_is_owner then raise exception 'Apenas o proprietário pode redefinir senhas de administradores' using errcode = '42501'; end if;
    select user_id, academy_id, status, is_owner, nome
    into v_target_user_id, v_target_academy_id, v_target_status, v_target_is_owner, v_target_name
    from public.academy_admins where id = p_target_id for update;
    if not found then raise exception 'Administrador não encontrado'; end if;
    if v_target_is_owner then raise exception 'A senha do proprietário não pode ser redefinida por este painel'; end if;
    if v_target_status <> 'ativo' then raise exception 'Ative o administrador antes de redefinir a senha'; end if;

    update auth.users set encrypted_password = crypt(p_temporary_password, gen_salt('bf')), updated_at = now()
    where id = v_target_user_id;
    if not found then raise exception 'Conta de acesso do administrador não encontrada'; end if;
    delete from auth.sessions where user_id = v_target_user_id;
    update public.academy_admins set is_first_login = true, updated_at = now()
    where id = p_target_id returning * into v_admin;

    insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, label, details)
    values (p_actor_user_id, coalesce(v_actor_email, 'sistema'), 'password_reset', 'academy_admins',
      p_target_id, v_target_name, jsonb_build_object('origem', 'servidor', 'academy_id', v_target_academy_id));
    return to_jsonb(v_admin);
  end if;

  if p_target_role = 'professor' then
    select user_id, academy_id, status, nome
    into v_target_user_id, v_target_academy_id, v_target_status, v_target_name
    from public.professores where id = p_target_id for update;
    if not found then raise exception 'Professor não encontrado'; end if;
    if not v_actor_is_owner and v_target_academy_id is distinct from v_actor_academy_id then
      raise exception 'Professor não encontrado ou acesso negado' using errcode = '42501';
    end if;
    if v_target_status = 'inativo' then raise exception 'Reative o professor antes de redefinir a senha'; end if;
    if v_target_user_id is null then raise exception 'Conta de acesso do professor não encontrada'; end if;

    update auth.users set encrypted_password = crypt(p_temporary_password, gen_salt('bf')), updated_at = now()
    where id = v_target_user_id;
    if not found then raise exception 'Conta de acesso do professor não encontrada'; end if;
    delete from auth.sessions where user_id = v_target_user_id;
    update public.professores set is_first_login = true where id = p_target_id returning * into v_professor;

    insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, label, details)
    values (p_actor_user_id, coalesce(v_actor_email, 'sistema'), 'password_reset', 'professores',
      p_target_id, v_target_name, jsonb_build_object('origem', 'servidor', 'academy_id', v_target_academy_id));
    return to_jsonb(v_professor);
  end if;

  raise exception 'Perfil inválido';
end;
$$;

revoke all on function public.reset_fitpro_access_password(uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reset_fitpro_access_password(uuid, text, uuid, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
