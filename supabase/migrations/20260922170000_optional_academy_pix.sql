-- Pix opcional por academia. Tokens só podem ser lidos pelo servidor.
begin;

create table if not exists public.academy_pix_connections (
  academy_id uuid primary key references public.academies(id) on delete cascade,
  enabled boolean not null default false,
  seller_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  live_mode boolean not null default false,
  connected_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint pix_enabled_requires_connection check (
    not enabled or (seller_id is not null and access_token_encrypted is not null)
  )
);

create table if not exists public.academy_pix_oauth_states (
  state_hash text primary key,
  academy_id uuid not null references public.academies(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pix_charges (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete restrict,
  aluno_id uuid not null references public.alunos(id) on delete restrict,
  period_due date not null,
  amount numeric(10,2) not null check (amount > 0),
  payer_email text not null,
  status text not null default 'creating' check (status in ('creating', 'pending', 'paid', 'expired', 'failed', 'review')),
  provider_order_id text unique,
  provider_payment_id text,
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  expires_at timestamptz,
  live_mode boolean not null default false,
  paid_at timestamptz,
  transacao_id uuid unique references public.transacoes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pix_one_open_charge_per_period
  on public.pix_charges (aluno_id, period_due)
  where status in ('creating', 'pending');
create index if not exists pix_charges_academy_status_idx
  on public.pix_charges (academy_id, status, created_at desc);
create index if not exists pix_charges_student_idx
  on public.pix_charges (aluno_id, created_at desc);

alter table public.academy_pix_connections enable row level security;
alter table public.academy_pix_oauth_states enable row level security;
alter table public.pix_charges enable row level security;

-- As funções de servidor gerenciam configurações e cobranças; o cliente só lê as próprias cobranças.
revoke all on public.academy_pix_connections from public, anon, authenticated;
revoke all on public.academy_pix_oauth_states from public, anon, authenticated;
revoke all on public.pix_charges from public, anon, authenticated;
grant all on public.academy_pix_connections to service_role;
grant all on public.academy_pix_oauth_states to service_role;
grant all on public.pix_charges to service_role;
grant select on public.pix_charges to authenticated;

create policy "pix_charges: own student read"
on public.pix_charges for select to authenticated
using (
  exists (
    select 1 from public.alunos a
    where a.id = aluno_id and a.user_id = auth.uid() and a.academy_id = academy_id
  )
);

create policy "pix_charges: academy admin read"
on public.pix_charges for select to authenticated
using (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id));

-- Confirma exatamente uma vez e só avança o vencimento ainda associado à cobrança.
create or replace function public.confirm_fitpro_pix_charge(
  p_charge_id uuid,
  p_order_id text,
  p_payment_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge public.pix_charges%rowtype;
  v_student public.alunos%rowtype;
  v_transaction_id uuid;
  v_new_due date;
begin
  select * into v_charge from public.pix_charges where id = p_charge_id for update;
  if not found or v_charge.provider_order_id is distinct from p_order_id then
    raise exception 'Cobrança Pix não encontrada';
  end if;
  if v_charge.status = 'paid' then return 'paid'; end if;
  if v_charge.status not in ('pending', 'creating') then
    raise exception 'Cobrança Pix não pode ser confirmada neste estado';
  end if;

  select * into v_student from public.alunos where id = v_charge.aluno_id for update;
  if not found or v_student.academy_id <> v_charge.academy_id then
    raise exception 'Aluno da cobrança não encontrado';
  end if;
  if v_student.vencimento is distinct from v_charge.period_due
     or (v_student.pagamento_status = 'pago' and v_student.vencimento >= current_date) then
    update public.pix_charges
    set status = 'review', provider_payment_id = p_payment_id,
        paid_at = now(), updated_at = now()
    where id = p_charge_id;
    return 'review';
  end if;

  v_new_due := (greatest(v_student.vencimento, current_date) + interval '1 month')::date;
  update public.alunos
  set pagamento_status = 'pago',
      forma_pagamento = 'PIX',
      status = case when status = 'atrasado' then 'ativo' else status end,
      vencimento = v_new_due
  where id = v_student.id;

  insert into public.transacoes (academy_id, tipo, categoria, descricao, valor, data, status, aluno_id)
  values (v_charge.academy_id, 'receita', 'Mensalidade', 'Mensalidade Pix - ' || v_student.nome,
          v_charge.amount, current_date, 'pago', v_student.id)
  returning id into v_transaction_id;

  update public.pix_charges
  set status = 'paid', provider_payment_id = p_payment_id,
      transacao_id = v_transaction_id, paid_at = now(), updated_at = now()
  where id = p_charge_id;
  return 'paid';
end;
$$;

revoke all on function public.confirm_fitpro_pix_charge(uuid, text, text) from public, anon, authenticated;
grant execute on function public.confirm_fitpro_pix_charge(uuid, text, text) to service_role;

commit;
