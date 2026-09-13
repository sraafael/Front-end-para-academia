-- Permite múltiplas academias e vincula cada administrador comum a uma delas.

begin;

drop index if exists public.academies_singleton_idx;

create or replace function public.current_fitpro_academy_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select academy_id
  from public.academy_admins
  where user_id = auth.uid()
    and status = 'ativo'
  limit 1;
$$;

revoke all on function public.current_fitpro_academy_id() from public, anon;
grant execute on function public.current_fitpro_academy_id() to authenticated;

-- Um administrador comum enxerga apenas a academia à qual está vinculado.
drop policy if exists "academies: admin read" on public.academies;
create policy "academies: admin read"
on public.academies for select to authenticated
using (
  public.is_fitpro_owner()
  or id = public.current_fitpro_academy_id()
);

drop function if exists public.complete_academy_admin_registration(uuid, text, text, text, text, text);

create function public.complete_academy_admin_registration(
  p_user_id uuid,
  p_nome text,
  p_cpf text,
  p_telefone text,
  p_email text,
  p_cargo text,
  p_academy_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin_id uuid;
  v_expected_email text;
  v_actual_email text;
begin
  if not public.is_fitpro_owner() then
    raise exception 'Apenas o proprietário pode cadastrar administradores';
  end if;

  if p_cpf !~ '^[0-9]{11}$' then
    raise exception 'CPF inválido';
  end if;

  if not exists (select 1 from public.academies where id = p_academy_id) then
    raise exception 'Academia não encontrada';
  end if;

  v_expected_email := 'admin.' || p_cpf || '@fitpro.internal';
  select lower(email) into v_actual_email from auth.users where id = p_user_id;
  if v_actual_email is null or v_actual_email <> v_expected_email then
    raise exception 'A conta de acesso não corresponde ao CPF informado';
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'role', 'admin',
          'is_owner', false,
          'academy_id', p_academy_id
        ),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'admin', 'cpf', p_cpf, 'nome', p_nome),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = p_user_id;

  insert into public.academy_admins (
    academy_id, user_id, nome, cpf, telefone, email, cargo,
    status, is_owner, is_first_login
  ) values (
    p_academy_id, p_user_id, trim(p_nome), p_cpf, trim(p_telefone),
    trim(p_email), coalesce(nullif(trim(p_cargo), ''), 'Administrador'),
    'ativo', false, true
  )
  returning id into v_admin_id;

  return v_admin_id;
end;
$$;

revoke all on function public.complete_academy_admin_registration(uuid, text, text, text, text, text, uuid) from public, anon;
grant execute on function public.complete_academy_admin_registration(uuid, text, text, text, text, text, uuid) to authenticated;

create or replace function public.assign_academy_admin(
  p_admin_id uuid,
  p_academy_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  if not public.is_fitpro_owner() then
    raise exception 'Apenas o proprietário pode alterar a academia do administrador';
  end if;

  if not exists (select 1 from public.academies where id = p_academy_id) then
    raise exception 'Academia não encontrada';
  end if;

  update public.academy_admins
  set academy_id = p_academy_id,
      updated_at = now()
  where id = p_admin_id
    and is_owner = false
  returning user_id into v_user_id;

  if v_user_id is null then
    raise exception 'Administrador não encontrado ou proprietário não pode ser limitado a uma academia';
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'admin', 'is_owner', false, 'academy_id', p_academy_id),
      updated_at = now()
  where id = v_user_id;
end;
$$;

revoke all on function public.assign_academy_admin(uuid, uuid) from public, anon;
grant execute on function public.assign_academy_admin(uuid, uuid) to authenticated;

-- Mantém os metadados protegidos sincronizados em instalações que já tenham administradores.
update auth.users as users
set raw_app_meta_data = coalesce(users.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'role', 'admin',
        'is_owner', false,
        'academy_id', admins.academy_id
      ),
    updated_at = now()
from public.academy_admins as admins
where users.id = admins.user_id
  and admins.is_owner = false;

commit;
