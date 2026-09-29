-- Modo de apresentação: uma única conta Mercado Pago do proprietário
-- recebe o Pix de todas as academias atuais e futuras.
begin;

create table if not exists public.owner_pix_connections (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  seller_id text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz,
  live_mode boolean not null default false,
  auto_attach boolean not null default true,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.owner_pix_connections enable row level security;
revoke all on public.owner_pix_connections from public, anon, authenticated;
grant all on public.owner_pix_connections to service_role;

alter table public.academy_pix_connections
  add column if not exists use_owner_account boolean not null default false;

alter table public.academy_pix_connections
  drop constraint if exists pix_enabled_requires_connection;
alter table public.academy_pix_connections
  add constraint pix_enabled_requires_connection check (
    not enabled
    or use_owner_account
    or (seller_id is not null and access_token_encrypted is not null)
  );

-- Depois que o proprietário autorizar sua conta, toda nova academia já nasce
-- vinculada e ativa. O token fica apenas na tabela do proprietário.
create or replace function public.attach_owner_pix_to_new_academy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_connection public.owner_pix_connections%rowtype;
begin
  if new.owner_id is null then return new; end if;

  select * into v_connection
  from public.owner_pix_connections
  where owner_user_id = new.owner_id and auto_attach = true;

  if found then
    insert into public.academy_pix_connections (
      academy_id, enabled, seller_id, live_mode, use_owner_account,
      connected_at, updated_at
    ) values (
      new.id, true, v_connection.seller_id, v_connection.live_mode, true,
      v_connection.connected_at, now()
    )
    on conflict (academy_id) do update set
      enabled = true,
      seller_id = excluded.seller_id,
      live_mode = excluded.live_mode,
      use_owner_account = true,
      access_token_encrypted = null,
      refresh_token_encrypted = null,
      token_expires_at = null,
      connected_at = excluded.connected_at,
      updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function public.attach_owner_pix_to_new_academy() from public, anon, authenticated;

drop trigger if exists academies_attach_owner_pix on public.academies;
create trigger academies_attach_owner_pix
after insert on public.academies
for each row execute function public.attach_owner_pix_to_new_academy();

commit;
