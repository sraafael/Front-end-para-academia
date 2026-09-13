-- ═══════════════════════════════════════════════════════════════════════════
-- FitPro — Schema completo
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute (Run All).
-- É idempotente: pode ser executado mais de uma vez sem erros.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extensões ────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Enums ────────────────────────────────────────────────────────────────────
do $$ begin create type user_role        as enum ('admin','professor','aluno');    exception when duplicate_object then null; end $$;
do $$ begin create type pagamento_status as enum ('pago','pendente','atrasado');   exception when duplicate_object then null; end $$;
do $$ begin create type professor_status as enum ('ativo','ferias','inativo');     exception when duplicate_object then null; end $$;
do $$ begin create type aluno_status     as enum ('ativo','atrasado','inativo');   exception when duplicate_object then null; end $$;
do $$ begin create type turma_status     as enum ('concluida','em_andamento','proxima','cancelada'); exception when duplicate_object then null; end $$;
do $$ begin create type transacao_tipo   as enum ('receita','despesa');            exception when duplicate_object then null; end $$;

-- ── profiles (espelho de auth.users com o campo role) ────────────────────────
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       user_role not null default 'aluno',
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;

-- O papel administrativo usa app_metadata (não editável pelo usuário). O
-- e-mail é mantido como compatibilidade com a conta admin já existente.
create or replace function public.is_fitpro_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false)
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role' = 'admin', false)
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fitpro.internal'
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    );
$$;

revoke all on function public.is_fitpro_admin() from public;
grant execute on function public.is_fitpro_admin() to authenticated;

drop policy if exists "profiles: owner read"     on profiles;
drop policy if exists "profiles: admin read all" on profiles;
create policy "profiles: owner read"     on profiles for select using (auth.uid() = id);
create policy "profiles: admin read all" on profiles for select using (
  public.is_fitpro_admin()
);

-- ── planos ───────────────────────────────────────────────────────────────────
create table if not exists planos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  preco       numeric(10,2) not null default 0 check (preco >= 0),
  duracao     text not null default '1 mês',
  modalidades text[] not null default '{}',
  beneficios  text[] not null default '{}',
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table planos enable row level security;

drop policy if exists "planos: auth read"   on planos;
drop policy if exists "planos: admin write" on planos;
create policy "planos: auth read"   on planos for select using (auth.role() = 'authenticated');
create policy "planos: admin write" on planos for all    using (
  public.is_fitpro_admin()
);

-- ── professores ─────────────────────────────────────────────────────────────
create table if not exists professores (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid unique references auth.users(id) on delete set null,
  nome          text not null,
  cpf           text unique not null,       -- armazenado sem formatação: 11111111111
  telefone      text not null default '',
  email         text not null default '',
  horario       text not null default '',
  salario       numeric(10,2) not null default 0 check (salario >= 0),
  especialidade text not null default '',
  status        professor_status not null default 'ativo',
  is_first_login boolean not null default true,
  ferias_inicio date,
  ferias_fim    date,
  created_at    timestamptz not null default now(),
  constraint professores_ferias_periodo_check check (
    (ferias_inicio is null and ferias_fim is null)
    or (ferias_inicio is not null and ferias_fim is not null and ferias_fim >= ferias_inicio)
  )
);
alter table professores enable row level security;

drop policy if exists "professores: admin all"  on professores;
drop policy if exists "professores: own read"   on professores;
create policy "professores: admin all" on professores for all    using (
  public.is_fitpro_admin()
);
create policy "professores: own read" on professores for select using (user_id = auth.uid());

-- ── alunos ───────────────────────────────────────────────────────────────────
create table if not exists alunos (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid unique references auth.users(id) on delete set null,
  nome                     text not null,
  cpf                      text unique not null,  -- sem formatação: 22222222222
  telefone                 text not null default '',
  email                    text not null default '',
  idade                    int not null default 0 check (idade >= 0),
  peso                     numeric(5,2) not null default 0 check (peso >= 0),
  -- FK obrigatória: aluno DEVE estar vinculado a um plano (ou null se cancelado)
  plano_id                 uuid references planos(id) on delete set null,
  professor_id             uuid references professores(id) on delete set null,
  status                   aluno_status not null default 'ativo',
  turma_id                 uuid,
  matricula_data           date not null default current_date,
  is_first_login           boolean not null default true,
  forma_pagamento          text not null default '',
  pagamento_status         pagamento_status not null default 'pendente',
  vencimento               date,
  sequencia                int not null default 0 check (sequencia >= 0),
  meta_semanal             int not null default 3 check (meta_semanal > 0),
  conquistas_desbloqueadas text[] not null default '{}',
  created_at               timestamptz not null default now()
);
alter table alunos enable row level security;

drop policy if exists "alunos: admin all"      on alunos;
drop policy if exists "alunos: professor read" on alunos;
drop policy if exists "alunos: own read"       on alunos;
drop policy if exists "alunos: own update"     on alunos;
-- Admin: acesso total
create policy "alunos: admin all" on alunos for all using (
  public.is_fitpro_admin()
);
-- Professor: leitura dos alunos vinculados ao próprio perfil
create policy "alunos: professor read" on alunos for select using (
  exists (
    select 1 from professores p
    where p.user_id = auth.uid() and p.id = alunos.professor_id
  )
);
-- Aluno: lê e atualiza apenas o próprio registro
create policy "alunos: own read"   on alunos for select using (user_id = auth.uid());
create policy "alunos: own update" on alunos for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── turmas ───────────────────────────────────────────────────────────────────
create table if not exists turmas (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  modalidade   text not null,
  horario      text not null,
  dias_semana  text[] not null default '{}',
  capacidade   int not null default 20 check (capacidade > 0),
  professor_id uuid references professores(id) on delete set null,
  sala         text not null default '',
  aluno_ids    uuid[] not null default '{}',
  status       turma_status not null default 'proxima',
  created_at   timestamptz not null default now()
);
alter table turmas enable row level security;

drop policy if exists "turmas: auth read"   on turmas;
drop policy if exists "turmas: admin write" on turmas;
create policy "turmas: auth read"   on turmas for select using (auth.role() = 'authenticated');
create policy "turmas: admin write" on turmas for all    using (
  public.is_fitpro_admin()
);

-- ── historico_peso ───────────────────────────────────────────────────────────
create table if not exists historico_peso (
  id         uuid primary key default gen_random_uuid(),
  aluno_id   uuid not null references alunos(id) on delete cascade,
  data       date not null default current_date,
  peso       numeric(5,2) not null check (peso > 0),
  created_at timestamptz not null default now()
);
alter table historico_peso enable row level security;

drop policy if exists "historico_peso: admin all" on historico_peso;
drop policy if exists "historico_peso: own all"   on historico_peso;
create policy "historico_peso: admin all" on historico_peso for all using (
  public.is_fitpro_admin()
);
create policy "historico_peso: own all" on historico_peso for all using (
  exists (select 1 from alunos where id = aluno_id and user_id = auth.uid())
);

-- ── frequencia ───────────────────────────────────────────────────────────────
create table if not exists frequencia (
  id         uuid primary key default gen_random_uuid(),
  aluno_id   uuid not null references alunos(id) on delete cascade,
  data       date not null default current_date,
  presente   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (aluno_id, data)
);
alter table frequencia enable row level security;

drop policy if exists "frequencia: admin all"      on frequencia;
drop policy if exists "frequencia: professor assigned" on frequencia;
drop policy if exists "frequencia: own read"        on frequencia;
create policy "frequencia: admin all" on frequencia for all using (
  public.is_fitpro_admin()
);
create policy "frequencia: professor assigned" on frequencia for all
  using (
    exists (
      select 1 from alunos a
      join professores p on p.id = a.professor_id
      where a.id = aluno_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from alunos a
      join professores p on p.id = a.professor_id
      where a.id = aluno_id and p.user_id = auth.uid()
    )
  );
create policy "frequencia: own read" on frequencia for select using (
  exists (select 1 from alunos where id = aluno_id and user_id = auth.uid())
);

-- ── transacoes ───────────────────────────────────────────────────────────────
-- Apenas admin pode ver ou modificar transações financeiras.
create table if not exists transacoes (
  id         uuid primary key default gen_random_uuid(),
  tipo       transacao_tipo not null,
  categoria  text not null,
  descricao  text not null default '',
  valor      numeric(10,2) not null check (valor > 0),
  data       date not null default current_date,
  status     pagamento_status,
  aluno_id   uuid references alunos(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table transacoes enable row level security;

drop policy if exists "transacoes: admin all" on transacoes;
create policy "transacoes: admin all" on transacoes for all using (
  public.is_fitpro_admin()
);

-- ── treinos ──────────────────────────────────────────────────────────────────
create table if not exists treinos (
  id         uuid primary key default gen_random_uuid(),
  aluno_id   uuid not null references alunos(id) on delete cascade,
  nome       text not null,
  grupo      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table treinos enable row level security;

drop policy if exists "treinos: staff all" on treinos;
drop policy if exists "treinos: admin all" on treinos;
drop policy if exists "treinos: professor assigned" on treinos;
drop policy if exists "treinos: own read"  on treinos;
create policy "treinos: admin all" on treinos for all using (public.is_fitpro_admin());
create policy "treinos: professor assigned" on treinos for all
  using (
    exists (
      select 1 from alunos a
      join professores p on p.id = a.professor_id
      where a.id = aluno_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from alunos a
      join professores p on p.id = a.professor_id
      where a.id = aluno_id and p.user_id = auth.uid()
    )
  );
-- Aluno só lê os próprios treinos
create policy "treinos: own read" on treinos for select using (
  exists (select 1 from alunos where id = aluno_id and user_id = auth.uid())
);

-- ── exercicios ───────────────────────────────────────────────────────────────
create table if not exists exercicios (
  id             uuid primary key default gen_random_uuid(),
  treino_id      uuid not null references treinos(id) on delete cascade,
  nome           text not null,
  series         int not null default 3 check (series > 0),
  reps           int not null default 10 check (reps > 0),
  carga_sugerida numeric(6,2) not null default 0 check (carga_sugerida >= 0),
  created_at     timestamptz not null default now()
);
alter table exercicios enable row level security;

drop policy if exists "exercicios: staff all" on exercicios;
drop policy if exists "exercicios: admin all" on exercicios;
drop policy if exists "exercicios: professor assigned" on exercicios;
drop policy if exists "exercicios: own read"  on exercicios;
create policy "exercicios: admin all" on exercicios for all using (public.is_fitpro_admin());
create policy "exercicios: professor assigned" on exercicios for all
  using (
    exists (
      select 1 from treinos t
      join alunos a on a.id = t.aluno_id
      join professores p on p.id = a.professor_id
      where t.id = treino_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from treinos t
      join alunos a on a.id = t.aluno_id
      join professores p on p.id = a.professor_id
      where t.id = treino_id and p.user_id = auth.uid()
    )
  );
create policy "exercicios: own read" on exercicios for select using (
  exists (
    select 1 from treinos t
    join alunos a on a.id = t.aluno_id
    where t.id = treino_id and a.user_id = auth.uid()
  )
);

-- ── series_realizadas ────────────────────────────────────────────────────────
create table if not exists series_realizadas (
  id           uuid primary key default gen_random_uuid(),
  exercicio_id uuid not null references exercicios(id) on delete cascade,
  serie_num    int not null check (serie_num > 0),
  carga_real   numeric(6,2) not null default 0 check (carga_real >= 0),
  repeticoes   int not null default 0 check (repeticoes >= 0),
  concluida    boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (exercicio_id, serie_num)
);
alter table series_realizadas enable row level security;

drop policy if exists "series: own all" on series_realizadas;
drop policy if exists "series: admin all" on series_realizadas;
drop policy if exists "series: professor assigned" on series_realizadas;
create policy "series: admin all" on series_realizadas for all using (public.is_fitpro_admin());
create policy "series: professor assigned" on series_realizadas for all
  using (
    exists (
      select 1 from exercicios ex
      join treinos t on t.id = ex.treino_id
      join alunos a on a.id = t.aluno_id
      join professores p on p.id = a.professor_id
      where ex.id = exercicio_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from exercicios ex
      join treinos t on t.id = ex.treino_id
      join alunos a on a.id = t.aluno_id
      join professores p on p.id = a.professor_id
      where ex.id = exercicio_id and p.user_id = auth.uid()
    )
  );
-- Aluno escreve apenas as próprias séries (percorrendo a cadeia de FKs)
create policy "series: own all" on series_realizadas for all using (
  exists (
    select 1 from exercicios ex
    join treinos t  on t.id  = ex.treino_id
    join alunos  a  on a.id  = t.aluno_id
    where ex.id = exercicio_id and a.user_id = auth.uid()
  )
);

-- O SQL Editor não concede privilégios de tabela automaticamente aos papéis
-- da API. As políticas abaixo continuam sendo a barreira de autorização.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  alunos,
  professores,
  planos,
  turmas,
  transacoes,
  historico_peso,
  frequencia,
  treinos,
  exercicios,
  series_realizadas
to authenticated;

-- Sincroniza a coluna alunos.turma_id com o array turmas.aluno_ids inclusive
-- em cadastros novos, preservando a capacidade máxima da turma.
create or replace function public.sync_aluno_turma_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacidade integer;
  v_ocupacao integer;
begin
  if tg_op = 'DELETE' then
    update public.turmas
    set aluno_ids = array_remove(aluno_ids, old.id)
    where old.id = any(aluno_ids);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.turma_id is not distinct from new.turma_id then
    return new;
  end if;

  update public.turmas
  set aluno_ids = array_remove(aluno_ids, new.id)
  where new.id = any(aluno_ids);

  if new.turma_id is not null then
    select capacidade, cardinality(aluno_ids)
    into v_capacidade, v_ocupacao
    from public.turmas
    where id = new.turma_id
    for update;

    if not found then raise exception 'Turma não encontrada'; end if;
    if v_ocupacao >= v_capacidade then raise exception 'A turma atingiu a capacidade máxima'; end if;

    update public.turmas
    set aluno_ids = array_append(aluno_ids, new.id)
    where id = new.turma_id;
  end if;

  return new;
end;
$$;

drop trigger if exists alunos_sync_turma on public.alunos;
create trigger alunos_sync_turma
after insert or update or delete on public.alunos
for each row execute function public.sync_aluno_turma_membership();

-- Mantém a data de revisão da ficha para os alertas operacionais de 45 dias.
create or replace function public.touch_treino_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists treinos_touch_updated_at on treinos;
create trigger treinos_touch_updated_at
  before update on treinos
  for each row execute function public.touch_treino_updated_at();

-- Salva uma ficha inteira de forma atômica. Exercícios existentes mantêm o ID
-- e, consequentemente, o histórico de séries já realizado pelo aluno.
create or replace function public.salvar_ficha_treino(
  p_treino_id uuid,
  p_aluno_id uuid,
  p_nome text,
  p_grupo text,
  p_exercicios jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_treino_id uuid;
  v_exercicio jsonb;
  v_exercicio_id uuid;
  v_series int;
  v_serie int;
  v_keep_ids uuid[] := '{}';
begin
  if trim(coalesce(p_nome, '')) = '' or trim(coalesce(p_grupo, '')) = '' then
    raise exception 'Nome e grupo da ficha são obrigatórios';
  end if;
  if jsonb_typeof(p_exercicios) <> 'array' or jsonb_array_length(p_exercicios) = 0 then
    raise exception 'A ficha precisa ter ao menos um exercício';
  end if;
  if not public.is_fitpro_admin() and not exists (
    select 1 from alunos a
    join professores p on p.id = a.professor_id
    where a.id = p_aluno_id and p.user_id = auth.uid()
  ) then
    raise exception 'Acesso negado para este aluno' using errcode = '42501';
  end if;

  if p_treino_id is null then
    insert into treinos (aluno_id, nome, grupo)
    values (p_aluno_id, trim(p_nome), trim(p_grupo))
    returning id into v_treino_id;
  else
    update treinos
      set nome = trim(p_nome), grupo = trim(p_grupo), updated_at = now()
      where id = p_treino_id and aluno_id = p_aluno_id
      returning id into v_treino_id;
    if v_treino_id is null then
      raise exception 'Ficha não encontrada para este aluno';
    end if;
  end if;

  for v_exercicio in select value from jsonb_array_elements(p_exercicios)
  loop
    v_series := greatest(1, coalesce((v_exercicio ->> 'series')::int, 1));
    v_exercicio_id := nullif(v_exercicio ->> 'id', '')::uuid;

    if v_exercicio_id is not null and exists (
      select 1 from exercicios where id = v_exercicio_id and treino_id = v_treino_id
    ) then
      update exercicios set
        nome = trim(v_exercicio ->> 'nome'),
        series = v_series,
        reps = greatest(1, coalesce((v_exercicio ->> 'reps')::int, 1)),
        carga_sugerida = greatest(0, coalesce((v_exercicio ->> 'carga_sugerida')::numeric, 0))
      where id = v_exercicio_id;
    else
      insert into exercicios (treino_id, nome, series, reps, carga_sugerida)
      values (
        v_treino_id,
        trim(v_exercicio ->> 'nome'),
        v_series,
        greatest(1, coalesce((v_exercicio ->> 'reps')::int, 1)),
        greatest(0, coalesce((v_exercicio ->> 'carga_sugerida')::numeric, 0))
      )
      returning id into v_exercicio_id;
    end if;

    v_keep_ids := array_append(v_keep_ids, v_exercicio_id);
    delete from series_realizadas where exercicio_id = v_exercicio_id and serie_num > v_series;
    for v_serie in 1..v_series loop
      insert into series_realizadas (exercicio_id, serie_num, carga_real, repeticoes, concluida)
      values (
        v_exercicio_id,
        v_serie,
        greatest(0, coalesce((v_exercicio ->> 'carga_sugerida')::numeric, 0)),
        greatest(1, coalesce((v_exercicio ->> 'reps')::int, 1)),
        false
      )
      on conflict (exercicio_id, serie_num) do nothing;
    end loop;
  end loop;

  delete from exercicios where treino_id = v_treino_id and not (id = any(v_keep_ids));
  update treinos set updated_at = now() where id = v_treino_id;
  return v_treino_id;
end;
$$;

revoke all on function public.salvar_ficha_treino(uuid, uuid, text, text, jsonb) from public;
grant execute on function public.salvar_ficha_treino(uuid, uuid, text, text, jsonb) to authenticated;

-- Atualiza o peso atual e o histórico na mesma transação.
create or replace function public.registrar_peso(p_aluno_id uuid, p_peso numeric, p_data date)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_peso <= 0 then
    raise exception 'O peso deve ser maior que zero';
  end if;
  update alunos set peso = p_peso where id = p_aluno_id;
  if not found then
    raise exception 'Aluno não encontrado ou acesso negado' using errcode = '42501';
  end if;
  insert into historico_peso (aluno_id, data, peso)
  values (p_aluno_id, coalesce(p_data, current_date), p_peso);
end;
$$;

revoke all on function public.registrar_peso(uuid, numeric, date) from public;
grant execute on function public.registrar_peso(uuid, numeric, date) to authenticated;

-- Mantém o vínculo redundante aluno.turma_id / turmas.aluno_ids consistente.
create or replace function public.vincular_aluno_turma(p_aluno_id uuid, p_turma_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_capacidade int;
  v_ocupacao int;
begin
  if not public.is_fitpro_admin() then
    raise exception 'Somente a administração pode alterar matrículas em turmas' using errcode = '42501';
  end if;
  if not exists (select 1 from alunos where id = p_aluno_id) then
    raise exception 'Aluno não encontrado';
  end if;

  update turmas set aluno_ids = array_remove(aluno_ids, p_aluno_id)
  where p_aluno_id = any(aluno_ids);

  if p_turma_id is not null then
    select capacidade, cardinality(aluno_ids)
      into v_capacidade, v_ocupacao
    from turmas where id = p_turma_id for update;
    if not found then raise exception 'Turma não encontrada'; end if;
    if v_ocupacao >= v_capacidade then raise exception 'A turma atingiu a capacidade máxima'; end if;
    update turmas
      set aluno_ids = case when p_aluno_id = any(aluno_ids) then aluno_ids else array_append(aluno_ids, p_aluno_id) end
      where id = p_turma_id;
  end if;

  update alunos set turma_id = p_turma_id where id = p_aluno_id;
end;
$$;

revoke all on function public.vincular_aluno_turma(uuid, uuid) from public;
grant execute on function public.vincular_aluno_turma(uuid, uuid) to authenticated;

-- Consulta dinâmica usada para exibir fichas ausentes ou sem revisão há 45 dias.
create or replace view public.alertas_treino
with (security_invoker = true)
as
select
  a.id as aluno_id,
  a.nome as aluno_nome,
  a.professor_id,
  max(t.updated_at) as ultima_atualizacao,
  case when count(t.id) = 0 then 'sem_ficha' else 'revisao' end as tipo
from alunos a
left join treinos t on t.aluno_id = a.id
where a.status = 'ativo'
group by a.id, a.nome, a.professor_id
having count(t.id) = 0 or max(t.updated_at) < now() - interval '45 days';

grant select on public.alertas_treino to authenticated;

-- ── Trigger: cria profile automaticamente ao registrar usuário ───────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_role user_role := 'aluno';
begin
  if new.raw_user_meta_data->>'role' is not null then
    v_role := (new.raw_user_meta_data->>'role')::user_role;
  end if;
  insert into profiles (id, role) values (new.id, v_role)
    on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Usuários criados antes do trigger também recebem um profile.
insert into profiles (id, role)
select
  id,
  case
    when lower(email) = 'admin@fitpro.internal' then 'admin'::user_role
    when raw_user_meta_data ->> 'role' in ('admin', 'professor', 'aluno')
      then (raw_user_meta_data ->> 'role')::user_role
    else 'aluno'::user_role
  end
from auth.users
on conflict (id) do update set role = excluded.role;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED: usuários de teste
-- Crie manualmente no Supabase Dashboard → Authentication → Users:
--
--   Admin:
--     Email:  admin@fitpro.internal
--     CPF:    54514214809
--     Senha:  defina somente no Supabase Auth; não versione credenciais reais
--     Metadata (raw): {"role":"admin","cpf":"54514214809"}
--
--   Professor Teste:
--     Email:  professor.11111111111@fitpro.internal
--     Senha:  prof@fitpro
--     Metadata (raw): {"role":"professor","cpf":"11111111111"}
--
--   Aluno Teste:
--     Email:  aluno.22222222222@fitpro.internal
--     Senha:  aluno@fitpro
--     Metadata (raw): {"role":"aluno","cpf":"22222222222"}
--
-- Depois de criar os usuários, pegue os UUIDs gerados e rode:
--
-- insert into professores (user_id, nome, cpf, especialidade, status)
-- values ('<UUID_PROFESSOR>', 'Professor Teste', '11111111111', 'Musculação', 'ativo')
-- on conflict (cpf) do update set user_id = excluded.user_id;
--
-- insert into alunos (user_id, nome, cpf, status, is_first_login)
-- values ('<UUID_ALUNO>', 'Aluno Teste', '22222222222', 'ativo', false)
-- on conflict (cpf) do update set user_id = excluded.user_id;
-- ═══════════════════════════════════════════════════════════════════════════
