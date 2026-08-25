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

drop policy if exists "profiles: owner read"     on profiles;
drop policy if exists "profiles: admin read all" on profiles;
create policy "profiles: owner read"     on profiles for select using (auth.uid() = id);
create policy "profiles: admin read all" on profiles for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
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
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
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
  created_at    timestamptz not null default now()
);
alter table professores enable row level security;

drop policy if exists "professores: admin all"  on professores;
drop policy if exists "professores: own read"   on professores;
create policy "professores: admin all" on professores for all    using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
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
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
-- Professor: leitura de todos os alunos (para chamada e dashboard)
create policy "alunos: professor read" on alunos for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'professor')
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
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
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
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
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
drop policy if exists "frequencia: professor write" on frequencia;
drop policy if exists "frequencia: own read"        on frequencia;
create policy "frequencia: admin all" on frequencia for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "frequencia: professor write" on frequencia for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','professor'))
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
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- ── treinos ──────────────────────────────────────────────────────────────────
create table if not exists treinos (
  id         uuid primary key default gen_random_uuid(),
  aluno_id   uuid not null references alunos(id) on delete cascade,
  nome       text not null,
  grupo      text not null default '',
  created_at timestamptz not null default now()
);
alter table treinos enable row level security;

drop policy if exists "treinos: staff all" on treinos;
drop policy if exists "treinos: own read"  on treinos;
create policy "treinos: staff all" on treinos for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','professor'))
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
drop policy if exists "exercicios: own read"  on exercicios;
create policy "exercicios: staff all" on exercicios for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','professor'))
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
-- Aluno escreve apenas as próprias séries (percorrendo a cadeia de FKs)
create policy "series: own all" on series_realizadas for all using (
  exists (
    select 1 from exercicios ex
    join treinos t  on t.id  = ex.treino_id
    join alunos  a  on a.id  = t.aluno_id
    where ex.id = exercicio_id and a.user_id = auth.uid()
  )
);

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

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED: usuários de teste
-- Crie manualmente no Supabase Dashboard → Authentication → Users:
--
--   Admin:
--     Email:  admin@fitpro.internal
--     Senha:  admin@fitpro
--     Metadata (raw): {"role":"admin"}
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
