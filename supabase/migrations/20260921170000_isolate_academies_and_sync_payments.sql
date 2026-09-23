-- Separa os dados operacionais por academia e registra mensalidades de forma atômica.

begin;

alter table public.planos add column if not exists academy_id uuid;
alter table public.professores add column if not exists academy_id uuid;
alter table public.alunos add column if not exists academy_id uuid;
alter table public.turmas add column if not exists academy_id uuid;
alter table public.transacoes add column if not exists academy_id uuid;
alter table public.turmas
  add column if not exists duracao_minutos integer not null default 60;

alter table public.turmas
  drop constraint if exists turmas_duracao_minutos_check;
alter table public.turmas
  add constraint turmas_duracao_minutos_check
  check (duracao_minutos between 15 and 480);

-- Instalações antigas com uma única academia podem ser migradas automaticamente.
-- Com várias academias, a migração para antes de fazer uma associação por suposição.
do $$
declare
  v_academy_count integer;
  v_academy_id uuid;
  v_has_unassigned_data boolean;
begin
  select count(*) into v_academy_count from public.academies;
  select id into v_academy_id
  from public.academies
  order by created_at, id
  limit 1;

  select
    exists (select 1 from public.planos where academy_id is null)
    or exists (select 1 from public.professores where academy_id is null)
    or exists (select 1 from public.alunos where academy_id is null)
    or exists (select 1 from public.turmas where academy_id is null)
    or exists (select 1 from public.transacoes where academy_id is null)
  into v_has_unassigned_data;

  if v_has_unassigned_data and v_academy_count <> 1 then
    raise exception using
      message = 'Existem dados sem academia e não há uma única unidade para o vínculo automático.',
      hint = 'Defina academy_id nos registros existentes antes de executar esta migração novamente.';
  end if;

  if v_has_unassigned_data then
    update public.planos set academy_id = v_academy_id where academy_id is null;
    update public.professores set academy_id = v_academy_id where academy_id is null;
    update public.alunos set academy_id = v_academy_id where academy_id is null;
    update public.turmas set academy_id = v_academy_id where academy_id is null;
    update public.transacoes set academy_id = v_academy_id where academy_id is null;
  end if;
end
$$;

alter table public.planos alter column academy_id set not null;
alter table public.professores alter column academy_id set not null;
alter table public.alunos alter column academy_id set not null;
alter table public.turmas alter column academy_id set not null;
alter table public.transacoes alter column academy_id set not null;

alter table public.planos drop constraint if exists planos_academy_id_fkey;
alter table public.professores drop constraint if exists professores_academy_id_fkey;
alter table public.alunos drop constraint if exists alunos_academy_id_fkey;
alter table public.turmas drop constraint if exists turmas_academy_id_fkey;
alter table public.transacoes drop constraint if exists transacoes_academy_id_fkey;

alter table public.planos
  add constraint planos_academy_id_fkey foreign key (academy_id) references public.academies(id) on delete restrict;
alter table public.professores
  add constraint professores_academy_id_fkey foreign key (academy_id) references public.academies(id) on delete restrict;
alter table public.alunos
  add constraint alunos_academy_id_fkey foreign key (academy_id) references public.academies(id) on delete restrict;
alter table public.turmas
  add constraint turmas_academy_id_fkey foreign key (academy_id) references public.academies(id) on delete restrict;
alter table public.transacoes
  add constraint transacoes_academy_id_fkey foreign key (academy_id) references public.academies(id) on delete restrict;

-- Impede vínculos acidentais entre registros de academias diferentes.
create or replace function public.validate_fitpro_academy_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'alunos' then
    if new.plano_id is not null and not exists (
      select 1 from public.planos where id = new.plano_id and academy_id = new.academy_id
    ) then
      raise exception 'O plano pertence a outra academia';
    end if;
    if new.professor_id is not null and not exists (
      select 1 from public.professores where id = new.professor_id and academy_id = new.academy_id
    ) then
      raise exception 'O professor pertence a outra academia';
    end if;
    if new.turma_id is not null and not exists (
      select 1 from public.turmas where id = new.turma_id and academy_id = new.academy_id
    ) then
      raise exception 'A turma pertence a outra academia';
    end if;
  elsif tg_table_name = 'turmas' then
    if new.professor_id is not null and not exists (
      select 1 from public.professores where id = new.professor_id and academy_id = new.academy_id
    ) then
      raise exception 'O professor pertence a outra academia';
    end if;
  elsif tg_table_name = 'transacoes' then
    if new.aluno_id is not null and not exists (
      select 1 from public.alunos where id = new.aluno_id and academy_id = new.academy_id
    ) then
      raise exception 'O aluno pertence a outra academia';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists alunos_validate_academy_links on public.alunos;
create trigger alunos_validate_academy_links
before insert or update of academy_id, plano_id, professor_id, turma_id on public.alunos
for each row execute function public.validate_fitpro_academy_links();

drop trigger if exists turmas_validate_academy_links on public.turmas;
create trigger turmas_validate_academy_links
before insert or update of academy_id, professor_id on public.turmas
for each row execute function public.validate_fitpro_academy_links();

drop trigger if exists transacoes_validate_academy_links on public.transacoes;
create trigger transacoes_validate_academy_links
before insert or update of academy_id, aluno_id on public.transacoes
for each row execute function public.validate_fitpro_academy_links();

create index if not exists planos_academy_id_idx on public.planos (academy_id);
create index if not exists professores_academy_id_idx on public.professores (academy_id);
create index if not exists alunos_academy_id_idx on public.alunos (academy_id);
create index if not exists turmas_academy_id_idx on public.turmas (academy_id);
create index if not exists transacoes_academy_id_data_idx on public.transacoes (academy_id, data desc);

alter table public.planos drop constraint if exists planos_nome_key;
alter table public.planos drop constraint if exists planos_academy_nome_key;
alter table public.planos
  add constraint planos_academy_nome_key unique (academy_id, nome);

-- Descobre a academia do usuário atual, independentemente do perfil de acesso.
create or replace function public.current_fitpro_academy_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select academy_id
      from public.academy_admins
      where user_id = auth.uid() and status = 'ativo'
      limit 1
    ),
    (
      select academy_id
      from public.professores
      where user_id = auth.uid() and status <> 'inativo'
      limit 1
    ),
    (
      select academy_id
      from public.alunos
      where user_id = auth.uid() and status <> 'inativo'
      limit 1
    )
  );
$$;

revoke all on function public.current_fitpro_academy_id() from public, anon;
grant execute on function public.current_fitpro_academy_id() to authenticated;

create or replace function public.can_access_fitpro_academy(p_academy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_fitpro_owner()
    or p_academy_id = public.current_fitpro_academy_id();
$$;

revoke all on function public.can_access_fitpro_academy(uuid) from public, anon;
grant execute on function public.can_access_fitpro_academy(uuid) to authenticated;

alter table public.planos alter column academy_id set default public.current_fitpro_academy_id();
alter table public.professores alter column academy_id set default public.current_fitpro_academy_id();
alter table public.alunos alter column academy_id set default public.current_fitpro_academy_id();
alter table public.turmas alter column academy_id set default public.current_fitpro_academy_id();
alter table public.transacoes alter column academy_id set default public.current_fitpro_academy_id();

-- Planos
drop policy if exists "planos: authenticated read" on public.planos;
drop policy if exists "planos: auth read" on public.planos;
drop policy if exists "planos: admin write" on public.planos;
drop policy if exists "planos: admin insert" on public.planos;
drop policy if exists "planos: admin update" on public.planos;
drop policy if exists "planos: admin delete" on public.planos;
drop policy if exists "planos: academy read" on public.planos;
drop policy if exists "planos: academy admin insert" on public.planos;
drop policy if exists "planos: academy admin update" on public.planos;
drop policy if exists "planos: academy admin delete" on public.planos;

create policy "planos: academy read"
on public.planos for select to authenticated
using (public.can_access_fitpro_academy(academy_id));

create policy "planos: academy admin insert"
on public.planos for insert to authenticated
with check (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id));

create policy "planos: academy admin update"
on public.planos for update to authenticated
using (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id))
with check (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id));

create policy "planos: academy admin delete"
on public.planos for delete to authenticated
using (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id));

-- Professores e alunos
drop policy if exists "professores: admin all" on public.professores;
create policy "professores: admin all"
on public.professores for all to authenticated
using (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id))
with check (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id));

drop policy if exists "alunos: admin all" on public.alunos;
create policy "alunos: admin all"
on public.alunos for all to authenticated
using (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id))
with check (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id));

-- Turmas e financeiro
drop policy if exists "turmas: auth read" on public.turmas;
drop policy if exists "turmas: admin write" on public.turmas;
drop policy if exists "turmas: academy read" on public.turmas;
create policy "turmas: academy read"
on public.turmas for select to authenticated
using (public.can_access_fitpro_academy(academy_id));
create policy "turmas: admin write"
on public.turmas for all to authenticated
using (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id))
with check (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id));

drop policy if exists "transacoes: admin all" on public.transacoes;
create policy "transacoes: admin all"
on public.transacoes for all to authenticated
using (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id))
with check (public.is_fitpro_admin() and public.can_access_fitpro_academy(academy_id));

-- Dados dependentes seguem a academia do aluno.
drop policy if exists "historico_peso: admin all" on public.historico_peso;
create policy "historico_peso: admin all"
on public.historico_peso for all to authenticated
using (
  public.is_fitpro_admin() and exists (
    select 1 from public.alunos a
    where a.id = historico_peso.aluno_id
      and public.can_access_fitpro_academy(a.academy_id)
  )
)
with check (
  public.is_fitpro_admin() and exists (
    select 1 from public.alunos a
    where a.id = historico_peso.aluno_id
      and public.can_access_fitpro_academy(a.academy_id)
  )
);

drop policy if exists "frequencia: admin all" on public.frequencia;
create policy "frequencia: admin all"
on public.frequencia for all to authenticated
using (
  public.is_fitpro_admin() and exists (
    select 1 from public.alunos a
    where a.id = frequencia.aluno_id
      and public.can_access_fitpro_academy(a.academy_id)
  )
)
with check (
  public.is_fitpro_admin() and exists (
    select 1 from public.alunos a
    where a.id = frequencia.aluno_id
      and public.can_access_fitpro_academy(a.academy_id)
  )
);

drop policy if exists "treinos: admin all" on public.treinos;
create policy "treinos: admin all"
on public.treinos for all to authenticated
using (
  public.is_fitpro_admin() and exists (
    select 1 from public.alunos a
    where a.id = treinos.aluno_id
      and public.can_access_fitpro_academy(a.academy_id)
  )
)
with check (
  public.is_fitpro_admin() and exists (
    select 1 from public.alunos a
    where a.id = treinos.aluno_id
      and public.can_access_fitpro_academy(a.academy_id)
  )
);

drop policy if exists "exercicios: admin all" on public.exercicios;
create policy "exercicios: admin all"
on public.exercicios for all to authenticated
using (
  public.is_fitpro_admin() and exists (
    select 1
    from public.treinos t
    join public.alunos a on a.id = t.aluno_id
    where t.id = exercicios.treino_id
      and public.can_access_fitpro_academy(a.academy_id)
  )
)
with check (
  public.is_fitpro_admin() and exists (
    select 1
    from public.treinos t
    join public.alunos a on a.id = t.aluno_id
    where t.id = exercicios.treino_id
      and public.can_access_fitpro_academy(a.academy_id)
  )
);

drop policy if exists "series: admin all" on public.series_realizadas;
create policy "series: admin all"
on public.series_realizadas for all to authenticated
using (
  public.is_fitpro_admin() and exists (
    select 1
    from public.exercicios e
    join public.treinos t on t.id = e.treino_id
    join public.alunos a on a.id = t.aluno_id
    where e.id = series_realizadas.exercicio_id
      and public.can_access_fitpro_academy(a.academy_id)
  )
)
with check (
  public.is_fitpro_admin() and exists (
    select 1
    from public.exercicios e
    join public.treinos t on t.id = e.treino_id
    join public.alunos a on a.id = t.aluno_id
    where e.id = series_realizadas.exercicio_id
      and public.can_access_fitpro_academy(a.academy_id)
  )
);

-- O próprio aluno não pode trocar a academia do seu perfil.
create or replace function public._trg_alunos_update_restrict()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_fitpro_admin() then
    return new;
  end if;

  if new.user_id is distinct from old.user_id then raise exception 'Not allowed to update user_id'; end if;
  if new.academy_id is distinct from old.academy_id then raise exception 'Not allowed to update academy_id'; end if;
  if new.professor_id is distinct from old.professor_id then raise exception 'Not allowed to update professor_id'; end if;
  if new.plano_id is distinct from old.plano_id then raise exception 'Not allowed to update plano_id'; end if;
  if new.status is distinct from old.status then raise exception 'Not allowed to update status'; end if;
  if new.forma_pagamento is distinct from old.forma_pagamento then raise exception 'Not allowed to update forma_pagamento'; end if;
  if new.pagamento_status is distinct from old.pagamento_status then raise exception 'Not allowed to update pagamento_status'; end if;
  if new.vencimento is distinct from old.vencimento then raise exception 'Not allowed to update vencimento'; end if;

  return new;
end;
$$;

-- O professor só pode ter a senha redefinida pela própria academia.
create or replace function public.reset_professor_password(
  p_professor_id uuid,
  p_temporary_password text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid;
  v_status public.professor_status;
  v_academy_id uuid;
begin
  if not public.is_fitpro_admin() then
    raise exception 'Apenas a administração pode redefinir senhas de professores';
  end if;
  if length(coalesce(p_temporary_password, '')) < 12 then
    raise exception 'A senha temporária deve possuir pelo menos 12 caracteres';
  end if;

  select user_id, status, academy_id
  into v_user_id, v_status, v_academy_id
  from public.professores
  where id = p_professor_id
  for update;

  if not found or not public.can_access_fitpro_academy(v_academy_id) then
    raise exception 'Professor não encontrado ou acesso negado';
  end if;
  if v_user_id is null then raise exception 'Conta de acesso do professor não encontrada'; end if;
  if v_status = 'inativo' then raise exception 'Reative o professor antes de redefinir a senha'; end if;

  update auth.users
  set encrypted_password = crypt(p_temporary_password, gen_salt('bf')),
      updated_at = now()
  where id = v_user_id;

  if not found then raise exception 'Conta de acesso do professor não encontrada'; end if;

  delete from auth.sessions where user_id = v_user_id;
  update public.professores set is_first_login = true where id = p_professor_id;
end;
$$;

revoke all on function public.reset_professor_password(uuid, text) from public, anon;
grant execute on function public.reset_professor_password(uuid, text) to authenticated;

-- Remove uma conta recém-criada quando o perfil público não pôde ser salvo.
create or replace function public.discard_incomplete_member_account(
  p_user_id uuid,
  p_expected_role text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role text;
  v_created_at timestamptz;
begin
  if not public.is_fitpro_admin() then
    raise exception 'Apenas a administração pode limpar cadastros incompletos';
  end if;
  if p_expected_role not in ('aluno', 'professor') then
    raise exception 'Perfil inválido';
  end if;

  select raw_user_meta_data ->> 'role', created_at
  into v_role, v_created_at
  from auth.users
  where id = p_user_id;

  if not found then return; end if;
  if v_role <> p_expected_role or v_created_at < now() - interval '10 minutes' then
    raise exception 'A conta não pode ser removida por esta operação';
  end if;
  if exists (select 1 from public.alunos where user_id = p_user_id)
    or exists (select 1 from public.professores where user_id = p_user_id)
    or exists (select 1 from public.academy_admins where user_id = p_user_id) then
    raise exception 'A conta já possui um perfil válido';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.discard_incomplete_member_account(uuid, text) from public, anon;
grant execute on function public.discard_incomplete_member_account(uuid, text) to authenticated;

-- Registra o recebimento e atualiza o vencimento do aluno na mesma transação.
create or replace function public.registrar_pagamento_mensalidade(
  p_aluno_id uuid,
  p_valor numeric,
  p_data date,
  p_descricao text default ''
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_aluno_nome text;
  v_academy_id uuid;
  v_vencimento date;
  v_transacao public.transacoes;
begin
  if not public.is_fitpro_admin() then
    raise exception 'Apenas a administração pode registrar mensalidades';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'O valor da mensalidade deve ser maior que zero';
  end if;

  select nome, academy_id,
    (greatest(coalesce(vencimento, coalesce(p_data, current_date)), coalesce(p_data, current_date)) + interval '1 month')::date
  into v_aluno_nome, v_academy_id, v_vencimento
  from public.alunos
  where id = p_aluno_id
  for update;

  if not found or not public.can_access_fitpro_academy(v_academy_id) then
    raise exception 'Aluno não encontrado ou acesso negado';
  end if;

  update public.alunos
  set pagamento_status = 'pago',
      status = case when status = 'atrasado' then 'ativo' else status end,
      vencimento = v_vencimento
  where id = p_aluno_id;

  insert into public.transacoes (
    academy_id, tipo, categoria, descricao, valor, data, status, aluno_id
  ) values (
    v_academy_id,
    'receita',
    'Mensalidade',
    coalesce(nullif(trim(p_descricao), ''), 'Mensalidade - ' || v_aluno_nome),
    p_valor,
    coalesce(p_data, current_date),
    'pago',
    p_aluno_id
  )
  returning * into v_transacao;

  return jsonb_build_object(
    'transacao', to_jsonb(v_transacao),
    'vencimento', v_vencimento
  );
end;
$$;

revoke all on function public.registrar_pagamento_mensalidade(uuid, numeric, date, text) from public, anon;
grant execute on function public.registrar_pagamento_mensalidade(uuid, numeric, date, text) to authenticated;

-- A recuperação aponta para a unidade correta do CPF informado.
create or replace function public.get_recovery_whatsapp(p_role text, p_cpf text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  if p_role not in ('admin', 'professor', 'aluno') or p_cpf !~ '^[0-9]{11}$' then
    return '';
  end if;

  if p_role = 'admin' then
    select a.telefone into v_phone
    from public.academy_admins u
    join public.academies a on a.id = u.academy_id
    where u.cpf = p_cpf and u.status = 'ativo'
    limit 1;
  elsif p_role = 'professor' then
    select a.telefone into v_phone
    from public.professores p
    join public.academies a on a.id = p.academy_id
    where p.cpf = p_cpf and p.status <> 'inativo'
    limit 1;
  else
    select a.telefone into v_phone
    from public.alunos u
    join public.academies a on a.id = u.academy_id
    where u.cpf = p_cpf and u.status <> 'inativo'
    limit 1;
  end if;

  return coalesce(regexp_replace(v_phone, '[^0-9]', '', 'g'), '');
end;
$$;

revoke all on function public.get_recovery_whatsapp(text, text) from public;
grant execute on function public.get_recovery_whatsapp(text, text) to anon, authenticated;

-- Uma academia com dados operacionais precisa ser esvaziada antes da exclusão.
create or replace function public.delete_fitpro_academy(p_academy_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_fitpro_owner() then raise exception 'Apenas o proprietário pode excluir academias'; end if;
  if not exists (select 1 from public.academies where id = p_academy_id) then raise exception 'Academia não encontrada'; end if;

  if exists (select 1 from public.academy_admins where academy_id = p_academy_id and is_owner = false) then
    raise exception 'Transfira ou exclua os administradores desta academia antes de excluí-la';
  end if;
  if exists (select 1 from public.alunos where academy_id = p_academy_id)
    or exists (select 1 from public.professores where academy_id = p_academy_id)
    or exists (select 1 from public.planos where academy_id = p_academy_id)
    or exists (select 1 from public.turmas where academy_id = p_academy_id)
    or exists (select 1 from public.transacoes where academy_id = p_academy_id) then
    raise exception 'A academia possui dados operacionais e não pode ser excluída';
  end if;

  update public.academy_admins
  set academy_id = null, updated_at = now()
  where academy_id = p_academy_id and is_owner = true;

  delete from public.academies where id = p_academy_id;
end;
$$;

revoke all on function public.delete_fitpro_academy(uuid) from public, anon;
grant execute on function public.delete_fitpro_academy(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
