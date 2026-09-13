-- Expõe somente o telefone público necessário para iniciar a recuperação via WhatsApp.

begin;

create or replace function public.get_recovery_whatsapp(
  p_role text,
  p_cpf text
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  if p_role not in ('admin', 'professor', 'aluno')
    or p_cpf !~ '^[0-9]{11}$' then
    return '';
  end if;

  -- Para administradores, usa a academia à qual o acesso foi designado.
  if p_role = 'admin' then
    select academies.telefone
    into v_phone
    from public.academy_admins as admins
    join public.academies as academies on academies.id = admins.academy_id
    where admins.cpf = p_cpf
      and admins.status = 'ativo'
    limit 1;
  end if;

  -- Alunos e professores ainda pertencem à unidade principal da instalação.
  -- Também funciona como alternativa quando um administrador ainda não foi vinculado.
  if coalesce(regexp_replace(v_phone, '[^0-9]', '', 'g'), '') = '' then
    select telefone
    into v_phone
    from public.academies
    where regexp_replace(telefone, '[^0-9]', '', 'g') <> ''
    order by created_at
    limit 1;
  end if;

  return coalesce(regexp_replace(v_phone, '[^0-9]', '', 'g'), '');
end;
$$;

revoke all on function public.get_recovery_whatsapp(text, text) from public;
grant execute on function public.get_recovery_whatsapp(text, text) to anon, authenticated;

commit;
