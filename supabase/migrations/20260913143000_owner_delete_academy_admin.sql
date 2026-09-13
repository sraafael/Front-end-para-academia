-- Exclusões protegidas para o painel do proprietário.

begin;

-- O proprietário pode continuar usando o sistema mesmo quando ainda não há academia cadastrada.
alter table public.academy_admins
  alter column academy_id drop not null;

alter table public.academy_admins
  drop constraint if exists academy_admins_academy_id_fkey;

alter table public.academy_admins
  add constraint academy_admins_academy_id_fkey
  foreign key (academy_id) references public.academies(id) on delete set null;

create or replace function public.delete_fitpro_academy(p_academy_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_fitpro_owner() then
    raise exception 'Apenas o proprietário pode excluir academias';
  end if;

  if not exists (select 1 from public.academies where id = p_academy_id) then
    raise exception 'Academia não encontrada';
  end if;

  if exists (
    select 1
    from public.academy_admins
    where academy_id = p_academy_id
      and is_owner = false
  ) then
    raise exception 'Transfira ou exclua os administradores desta academia antes de excluí-la';
  end if;

  update public.academy_admins
  set academy_id = null,
      updated_at = now()
  where academy_id = p_academy_id
    and is_owner = true;

  delete from public.academies where id = p_academy_id;
end;
$$;

revoke all on function public.delete_fitpro_academy(uuid) from public, anon;
grant execute on function public.delete_fitpro_academy(uuid) to authenticated;

create or replace function public.delete_academy_admin(p_admin_id uuid)
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
    raise exception 'Apenas o proprietário pode excluir administradores';
  end if;

  select user_id, is_owner
  into v_user_id, v_is_owner
  from public.academy_admins
  where id = p_admin_id
  for update;

  if not found then
    raise exception 'Administrador não encontrado';
  end if;

  if v_is_owner then
    raise exception 'O proprietário não pode ser excluído';
  end if;

  if v_user_id is null then
    delete from public.academy_admins where id = p_admin_id;
  else
    delete from auth.users where id = v_user_id;
    if not found then
      delete from public.academy_admins where id = p_admin_id;
    end if;
  end if;
end;
$$;

revoke all on function public.delete_academy_admin(uuid) from public, anon;
grant execute on function public.delete_academy_admin(uuid) to authenticated;

commit;
