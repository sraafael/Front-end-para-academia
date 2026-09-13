-- Edição protegida de administradores e redefinição para uma nova senha temporária.

begin;

-- Um administrador inativo deixa de possuir privilégios mesmo que ainda tenha um token antigo.
create or replace function public.is_fitpro_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_fitpro_owner()
    or (
      coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false)
      and exists (
        select 1
        from public.academy_admins
        where user_id = auth.uid()
          and status = 'ativo'
      )
    );
$$;

revoke all on function public.is_fitpro_admin() from public, anon;
grant execute on function public.is_fitpro_admin() to authenticated;

create or replace function public.update_academy_admin(
  p_admin_id uuid,
  p_academy_id uuid,
  p_nome text,
  p_telefone text,
  p_email text,
  p_cargo text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_is_owner boolean;
begin
  if not public.is_fitpro_owner() then
    raise exception 'Apenas o proprietário pode editar administradores';
  end if;

  if trim(coalesce(p_nome, '')) = '' then
    raise exception 'Informe o nome do administrador';
  end if;

  if p_status not in ('ativo', 'inativo') then
    raise exception 'Status inválido';
  end if;

  select user_id, is_owner
  into v_user_id, v_is_owner
  from public.academy_admins
  where id = p_admin_id
  for update;

  if v_user_id is null then
    raise exception 'Administrador não encontrado';
  end if;

  if not v_is_owner
    and not exists (select 1 from public.academies where id = p_academy_id) then
    raise exception 'Academia não encontrada';
  end if;

  update public.academy_admins
  set academy_id = case when v_is_owner then academy_id else p_academy_id end,
      nome = trim(p_nome),
      telefone = trim(coalesce(p_telefone, '')),
      email = trim(coalesce(p_email, '')),
      cargo = coalesce(nullif(trim(p_cargo), ''), 'Administrador'),
      status = case when v_is_owner then 'ativo' else p_status end,
      updated_at = now()
  where id = p_admin_id;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('nome', trim(p_nome)),
      raw_app_meta_data = case
        when v_is_owner then raw_app_meta_data
        else coalesce(raw_app_meta_data, '{}'::jsonb)
          || jsonb_build_object('role', 'admin', 'is_owner', false, 'academy_id', p_academy_id)
      end,
      updated_at = now()
  where id = v_user_id;
end;
$$;

revoke all on function public.update_academy_admin(uuid, uuid, text, text, text, text, text) from public, anon;
grant execute on function public.update_academy_admin(uuid, uuid, text, text, text, text, text) to authenticated;

create or replace function public.reset_academy_admin_password(
  p_admin_id uuid,
  p_temporary_password text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid;
  v_is_owner boolean;
  v_status text;
begin
  if not public.is_fitpro_owner() then
    raise exception 'Apenas o proprietário pode redefinir senhas de administradores';
  end if;

  if length(coalesce(p_temporary_password, '')) < 12 then
    raise exception 'A senha temporária deve possuir pelo menos 12 caracteres';
  end if;

  select user_id, is_owner, status
  into v_user_id, v_is_owner, v_status
  from public.academy_admins
  where id = p_admin_id
  for update;

  if v_user_id is null then
    raise exception 'Administrador não encontrado';
  end if;

  if v_is_owner then
    raise exception 'A senha do proprietário não pode ser redefinida por este painel';
  end if;

  if v_status <> 'ativo' then
    raise exception 'Ative o administrador antes de redefinir a senha';
  end if;

  update auth.users
  set encrypted_password = crypt(p_temporary_password, gen_salt('bf')),
      updated_at = now()
  where id = v_user_id;

  if not found then
    raise exception 'Conta de acesso do administrador não encontrada';
  end if;

  -- Encerra acessos antigos para que somente a nova senha temporária seja aceita.
  delete from auth.sessions where user_id = v_user_id;

  update public.academy_admins
  set is_first_login = true,
      updated_at = now()
  where id = p_admin_id;
end;
$$;

revoke all on function public.reset_academy_admin_password(uuid, text) from public, anon;
grant execute on function public.reset_academy_admin_password(uuid, text) to authenticated;

commit;
