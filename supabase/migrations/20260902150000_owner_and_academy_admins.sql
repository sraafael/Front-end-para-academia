-- Separa o proprietário dos administradores comuns e cadastra a academia.

begin;

create or replace function public.is_fitpro_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fitpro.internal'
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_owner')::boolean, false);
$$;

revoke all on function public.is_fitpro_owner() from public, anon;
grant execute on function public.is_fitpro_owner() to authenticated;

-- A autorização administrativa confia apenas nos metadados protegidos do Auth.
-- user_metadata é editável pelo próprio usuário e não deve conceder privilégios.
create or replace function public.is_fitpro_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_fitpro_owner()
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false);
$$;

revoke all on function public.is_fitpro_admin() from public, anon;
grant execute on function public.is_fitpro_admin() to authenticated;

create table if not exists public.academies (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references auth.users(id) on delete set null,
  nome_fantasia text not null default '',
  razao_social  text not null default '',
  cnpj          text not null default '',
  telefone      text not null default '',
  email         text not null default '',
  site          text not null default '',
  cep           text not null default '',
  endereco      text not null default '',
  numero        text not null default '',
  complemento   text not null default '',
  bairro        text not null default '',
  cidade        text not null default '',
  estado        text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists academies_singleton_idx on public.academies ((true));
alter table public.academies enable row level security;

create table if not exists public.academy_admins (
  id             uuid primary key default gen_random_uuid(),
  academy_id     uuid not null references public.academies(id) on delete cascade,
  user_id        uuid unique references auth.users(id) on delete cascade,
  nome           text not null,
  cpf            text not null unique,
  telefone       text not null default '',
  email          text not null default '',
  cargo          text not null default 'Administrador',
  status         text not null default 'ativo' check (status in ('ativo', 'inativo')),
  is_owner       boolean not null default false,
  is_first_login boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.academy_admins enable row level security;

do $$
declare
  v_owner_id uuid;
  v_academy_id uuid;
begin
  select id into v_owner_id
  from auth.users
  where lower(email) = 'admin@fitpro.internal'
  limit 1;

  if v_owner_id is null then
    return;
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'admin', 'is_owner', true),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'admin', 'cpf', '54514214809'),
      updated_at = now()
  where id = v_owner_id;

  select id into v_academy_id from public.academies limit 1;
  if v_academy_id is null then
    insert into public.academies (owner_id, nome_fantasia)
    values (v_owner_id, 'Minha Academia')
    returning id into v_academy_id;
  else
    update public.academies set owner_id = v_owner_id where id = v_academy_id;
  end if;

  insert into public.academy_admins (
    academy_id, user_id, nome, cpf, cargo, status, is_owner, is_first_login
  ) values (
    v_academy_id, v_owner_id, 'Proprietário FitPro', '54514214809',
    'Proprietário', 'ativo', true, false
  )
  on conflict (user_id) do update set
    academy_id = excluded.academy_id,
    cpf = excluded.cpf,
    is_owner = true,
    is_first_login = false,
    status = 'ativo';
end;
$$;

grant select, insert, update on table public.academies to authenticated;
grant select, insert, update on table public.academy_admins to authenticated;

drop policy if exists "academies: admin read" on public.academies;
drop policy if exists "academies: owner write" on public.academies;
create policy "academies: admin read"
on public.academies for select to authenticated
using (public.is_fitpro_admin());
create policy "academies: owner write"
on public.academies for all to authenticated
using (public.is_fitpro_owner())
with check (public.is_fitpro_owner());

drop policy if exists "academy_admins: owner all" on public.academy_admins;
drop policy if exists "academy_admins: own read" on public.academy_admins;
drop policy if exists "academy_admins: own first login" on public.academy_admins;
create policy "academy_admins: owner all"
on public.academy_admins for all to authenticated
using (public.is_fitpro_owner())
with check (public.is_fitpro_owner());
create policy "academy_admins: own read"
on public.academy_admins for select to authenticated
using (user_id = auth.uid());
create policy "academy_admins: own first login"
on public.academy_admins for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and is_owner = false);

-- Somente o proprietário pode ler a auditoria.
drop policy if exists "audit_logs: admin read" on public.audit_logs;
drop policy if exists "audit_logs: owner read" on public.audit_logs;
create policy "audit_logs: owner read"
on public.audit_logs for select to authenticated
using (public.is_fitpro_owner());

drop trigger if exists audit_academies on public.academies;
create trigger audit_academies
after insert or update or delete on public.academies
for each row execute function public.capture_fitpro_audit();

drop trigger if exists audit_academy_admins on public.academy_admins;
create trigger audit_academy_admins
after insert or update or delete on public.academy_admins
for each row execute function public.capture_fitpro_audit();

create or replace function public.complete_academy_admin_registration(
  p_user_id uuid,
  p_nome text,
  p_cpf text,
  p_telefone text,
  p_email text,
  p_cargo text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_academy_id uuid;
  v_admin_id uuid;
  v_expected_email text;
  v_actual_email text;
begin
  if not public.is_fitpro_owner() then
    raise exception 'Apenas o proprietário pode cadastrar administradores';
  end if;

  if p_cpf !~ '^\d{11}$' then
    raise exception 'CPF inválido';
  end if;

  v_expected_email := 'admin.' || p_cpf || '@fitpro.internal';
  select lower(email) into v_actual_email from auth.users where id = p_user_id;
  if v_actual_email is null or v_actual_email <> v_expected_email then
    raise exception 'A conta de acesso não corresponde ao CPF informado';
  end if;

  select id into v_academy_id from public.academies limit 1;
  if v_academy_id is null then
    raise exception 'Cadastre as informações da academia antes do administrador';
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'admin', 'is_owner', false),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'admin', 'cpf', p_cpf, 'nome', p_nome),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = p_user_id;

  insert into public.academy_admins (
    academy_id, user_id, nome, cpf, telefone, email, cargo,
    status, is_owner, is_first_login
  ) values (
    v_academy_id, p_user_id, trim(p_nome), p_cpf, trim(p_telefone),
    trim(p_email), coalesce(nullif(trim(p_cargo), ''), 'Administrador'),
    'ativo', false, true
  )
  returning id into v_admin_id;

  return v_admin_id;
end;
$$;

revoke all on function public.complete_academy_admin_registration(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.complete_academy_admin_registration(uuid, text, text, text, text, text) to authenticated;

commit;
