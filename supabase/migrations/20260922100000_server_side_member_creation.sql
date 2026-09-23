-- Mantém a criação de perfis no servidor e vincula todos os dados à academia correta.

begin;

create or replace function public.create_fitpro_member_profile(
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
  v_plano_id uuid := nullif(p_profile ->> 'plano_id', '')::uuid;
  v_professor_id uuid := nullif(p_profile ->> 'professor_id', '')::uuid;
  v_turma_id uuid := nullif(p_profile ->> 'turma_id', '')::uuid;
  v_matricula_data date := coalesce(nullif(p_profile ->> 'matricula_data', '')::date, current_date);
  v_peso numeric := coalesce(nullif(p_profile ->> 'peso', '')::numeric, 0);
  v_capacidade integer;
  v_ocupacao integer;
  v_aluno public.alunos;
  v_professor public.professores;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Operação permitida apenas ao servidor' using errcode = '42501';
  end if;
  if p_role not in ('aluno', 'professor') then raise exception 'Perfil inválido'; end if;
  if v_nome = '' then raise exception 'Informe o nome'; end if;
  if v_cpf !~ '^[0-9]{11}$' then raise exception 'Informe um CPF válido'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'Conta de acesso não encontrada'; end if;
  if not exists (select 1 from public.academies where id = p_academy_id) then raise exception 'Academia não encontrada'; end if;

  if p_role = 'professor' then
    insert into public.professores (
      id, user_id, academy_id, nome, cpf, telefone, email, horario,
      salario, especialidade, status, is_first_login
    ) values (
      p_user_id,
      p_user_id,
      p_academy_id,
      v_nome,
      v_cpf,
      coalesce(p_profile ->> 'telefone', ''),
      coalesce(p_profile ->> 'email', ''),
      coalesce(p_profile ->> 'horario', ''),
      coalesce(nullif(p_profile ->> 'salario', '')::numeric, 0),
      coalesce(p_profile ->> 'especialidade', ''),
      coalesce(nullif(p_profile ->> 'status', ''), 'ativo')::public.professor_status,
      true
    )
    returning * into v_professor;

    return to_jsonb(v_professor);
  end if;

  if v_plano_id is not null and not exists (
    select 1 from public.planos where id = v_plano_id and academy_id = p_academy_id
  ) then raise exception 'O plano não pertence a esta academia'; end if;

  if v_professor_id is not null and not exists (
    select 1 from public.professores where id = v_professor_id and academy_id = p_academy_id
  ) then raise exception 'O professor não pertence a esta academia'; end if;

  if v_turma_id is not null then
    select capacidade, cardinality(aluno_ids)
    into v_capacidade, v_ocupacao
    from public.turmas
    where id = v_turma_id and academy_id = p_academy_id
    for update;

    if not found then raise exception 'A turma não pertence a esta academia'; end if;
    if v_ocupacao >= v_capacidade then raise exception 'A turma atingiu a capacidade máxima'; end if;
  end if;

  insert into public.alunos (
    id, user_id, academy_id, nome, cpf, telefone, email, idade, peso,
    plano_id, professor_id, status, turma_id, matricula_data,
    is_first_login, forma_pagamento, pagamento_status, vencimento
  ) values (
    p_user_id,
    p_user_id,
    p_academy_id,
    v_nome,
    v_cpf,
    coalesce(p_profile ->> 'telefone', ''),
    coalesce(p_profile ->> 'email', ''),
    coalesce(nullif(p_profile ->> 'idade', '')::integer, 0),
    v_peso,
    v_plano_id,
    v_professor_id,
    coalesce(nullif(p_profile ->> 'status', ''), 'ativo')::public.aluno_status,
    v_turma_id,
    v_matricula_data,
    true,
    coalesce(p_profile ->> 'forma_pagamento', ''),
    'pendente',
    nullif(p_profile ->> 'vencimento', '')::date
  )
  returning * into v_aluno;

  if v_turma_id is not null then
    update public.turmas
    set aluno_ids = case
      when p_user_id = any(aluno_ids) then aluno_ids
      else array_append(aluno_ids, p_user_id)
    end
    where id = v_turma_id;
  end if;

  if v_peso > 0 then
    insert into public.historico_peso (aluno_id, data, peso)
    values (p_user_id, v_matricula_data, v_peso)
    on conflict do nothing;
  end if;

  return to_jsonb(v_aluno);
end;
$$;

revoke all on function public.create_fitpro_member_profile(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_fitpro_member_profile(uuid, text, uuid, jsonb) to service_role;

notify pgrst, 'reload schema';

commit;
