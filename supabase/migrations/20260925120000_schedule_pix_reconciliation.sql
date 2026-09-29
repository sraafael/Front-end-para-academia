-- Confere cobranças Pix reais mesmo quando o aluno não está com o site aberto.
alter table public.pix_charges
  add column if not exists last_reconciled_at timestamptz;

create index if not exists pix_charges_reconcile_idx
  on public.pix_charges (last_reconciled_at asc nulls first)
  where live_mode = true
    and provider_order_id is not null
    and status in ('creating', 'pending');

create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Os valores são lidos do Vault a cada execução, sem entrar no código ou no cron.
create or replace function public.request_fitpro_pix_reconciliation()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_url text;
  v_secret text;
begin
  if to_regclass('vault.decrypted_secrets') is null then return; end if;

  select decrypted_secret into v_project_url
  from vault.decrypted_secrets
  where name = 'fitpro_pix_reconcile_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'fitpro_pix_reconcile_secret';

  if v_project_url is null or v_project_url !~ '^https://[a-z0-9-]+\.supabase\.co/?$'
     or v_secret is null or length(v_secret) < 32 then
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/pix-reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-fitpro-reconcile-secret', v_secret
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.request_fitpro_pix_reconciliation() from public, anon, authenticated, service_role;

-- Sem os dois segredos no Vault, a rotina não faz chamadas externas.
select cron.schedule(
  'fitpro-pix-reconcile',
  '*/5 * * * *',
  $job$select public.request_fitpro_pix_reconciliation()$job$
);
