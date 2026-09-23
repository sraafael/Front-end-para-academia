-- Separa cobranças de teste das reais e impede que uma simulação quite mensalidades.
begin;

drop index if exists public.pix_one_open_charge_per_period;
create unique index pix_one_open_charge_per_period
  on public.pix_charges (aluno_id, period_due, live_mode)
  where status in ('creating', 'pending');

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

  -- O sandbox comprova a integração, mas não representa dinheiro recebido.
  if not v_charge.live_mode then
    update public.pix_charges
    set status = 'paid', provider_payment_id = p_payment_id,
        paid_at = now(), updated_at = now()
    where id = p_charge_id;
    return 'test_paid';
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
