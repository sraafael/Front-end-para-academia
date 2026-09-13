-- ═══════════════════════════════════════════════════════════════════════════
-- Funcionalidades complementares do TCC
-- Conclui as pendências funcionais descritas no TCC:
-- primeiro acesso do professor, chamada persistida, fichas gerenciadas pelo
-- professor, alertas de revisão e RLS por vínculo professor-aluno.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Campos complementares ──────────────────────────────────────────────

alter table public.professores
  add column if not exists is_first_login boolean not null default true;

alter table public.alunos
  add column if not exists professor_id uuid references public.professores(id) on delete set null;

alter table public.treinos
  add column if not exists updated_at timestamptz not null default now();

-- ── Frequência: acesso por vínculo professor-aluno ──────────────────────────

drop policy if exists "frequencia: professor write" on public.frequencia;
drop policy if exists "frequencia: professor assigned" on public.frequencia;
create policy "frequencia: professor assigned"
on public.frequencia for all to authenticated
using (
  exists (
    select 1
    from public.alunos a
    join public.professores p on p.id = a.professor_id
    where a.id = frequencia.aluno_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.alunos a
    join public.professores p on p.id = a.professor_id
    where a.id = frequencia.aluno_id and p.user_id = auth.uid()
  )
);

-- ── Fichas e exercícios: acesso por vínculo ──────────────────────────────────

drop policy if exists "treinos: staff all" on public.treinos;
drop policy if exists "treinos: admin all" on public.treinos;
drop policy if exists "treinos: professor assigned" on public.treinos;
create policy "treinos: admin all"
on public.treinos for all to authenticated
using (public.is_fitpro_admin())
with check (public.is_fitpro_admin());
create policy "treinos: professor assigned"
on public.treinos for all to authenticated
using (
  exists (
    select 1
    from public.alunos a
    join public.professores p on p.id = a.professor_id
    where a.id = treinos.aluno_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.alunos a
    join public.professores p on p.id = a.professor_id
    where a.id = treinos.aluno_id and p.user_id = auth.uid()
  )
);

drop policy if exists "exercicios: staff all" on public.exercicios;
drop policy if exists "exercicios: admin all" on public.exercicios;
drop policy if exists "exercicios: professor assigned" on public.exercicios;
create policy "exercicios: admin all"
on public.exercicios for all to authenticated
using (public.is_fitpro_admin())
with check (public.is_fitpro_admin());
create policy "exercicios: professor assigned"
on public.exercicios for all to authenticated
using (
  exists (
    select 1
    from public.treinos t
    join public.alunos a on a.id = t.aluno_id
    join public.professores p on p.id = a.professor_id
    where t.id = exercicios.treino_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.treinos t
    join public.alunos a on a.id = t.aluno_id
    join public.professores p on p.id = a.professor_id
    where t.id = exercicios.treino_id and p.user_id = auth.uid()
  )
);

-- ── Séries realizadas: acesso por vínculo ───────────────────────────────────

drop policy if exists "series: admin all" on public.series_realizadas;
drop policy if exists "series: professor assigned" on public.series_realizadas;
create policy "series: admin all"
on public.series_realizadas for all to authenticated
using (public.is_fitpro_admin())
with check (public.is_fitpro_admin());
create policy "series: professor assigned"
on public.series_realizadas for all to authenticated
using (
  exists (
    select 1
    from public.exercicios ex
    join public.treinos t on t.id = ex.treino_id
    join public.alunos a on a.id = t.aluno_id
    join public.professores p on p.id = a.professor_id
    where ex.id = series_realizadas.exercicio_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.exercicios ex
    join public.treinos t on t.id = ex.treino_id
    join public.alunos a on a.id = t.aluno_id
    join public.professores p on p.id = a.professor_id
    where ex.id = series_realizadas.exercicio_id and p.user_id = auth.uid()
  )
);

-- ── Atualização automática da revisão da ficha ───────────────────────────

create or replace function public.touch_treino_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists treinos_touch_updated_at on public.treinos;
create trigger treinos_touch_updated_at
before update on public.treinos
for each row execute function public.touch_treino_updated_at();

-- ── Gravação atômica da ficha de treino ─────────────────────────────────

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
    select 1
    from public.alunos a
    join public.professores p on p.id = a.professor_id
    where a.id = p_aluno_id and p.user_id = auth.uid()
  ) then
    raise exception 'Acesso negado para este aluno' using errcode = '42501';
  end if;

  if p_treino_id is null then
    insert into public.treinos (aluno_id, nome, grupo)
    values (p_aluno_id, trim(p_nome), trim(p_grupo))
    returning id into v_treino_id;
  else
    update public.treinos
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
      select 1 from public.exercicios where id = v_exercicio_id and treino_id = v_treino_id
    ) then
      update public.exercicios set
        nome = trim(v_exercicio ->> 'nome'),
        series = v_series,
        reps = greatest(1, coalesce((v_exercicio ->> 'reps')::int, 1)),
        carga_sugerida = greatest(0, coalesce((v_exercicio ->> 'carga_sugerida')::numeric, 0))
      where id = v_exercicio_id;
    else
      insert into public.exercicios (treino_id, nome, series, reps, carga_sugerida)
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
    delete from public.series_realizadas where exercicio_id = v_exercicio_id and serie_num > v_series;
    for v_serie in 1..v_series loop
      insert into public.series_realizadas (exercicio_id, serie_num, carga_real, repeticoes, concluida)
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

  delete from public.exercicios
  where treino_id = v_treino_id and not (id = any(v_keep_ids));
  update public.treinos set updated_at = now() where id = v_treino_id;
  return v_treino_id;
end;
$$;

revoke all on function public.salvar_ficha_treino(uuid, uuid, text, text, jsonb) from public;
grant execute on function public.salvar_ficha_treino(uuid, uuid, text, text, jsonb) to authenticated;

-- ── Atualização do peso e do histórico ──────────────────────────────────

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
  update public.alunos set peso = p_peso where id = p_aluno_id;
  if not found then
    raise exception 'Aluno não encontrado ou acesso negado' using errcode = '42501';
  end if;
  insert into public.historico_peso (aluno_id, data, peso)
  values (p_aluno_id, coalesce(p_data, current_date), p_peso);
end;
$$;

revoke all on function public.registrar_peso(uuid, numeric, date) from public;
grant execute on function public.registrar_peso(uuid, numeric, date) to authenticated;

-- ── Vínculo entre aluno e turma ──────────────────────────────────────────────

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
  if not exists (select 1 from public.alunos where id = p_aluno_id) then
    raise exception 'Aluno não encontrado';
  end if;

  update public.turmas set aluno_ids = array_remove(aluno_ids, p_aluno_id)
  where p_aluno_id = any(aluno_ids);

  if p_turma_id is not null then
    select capacidade, cardinality(aluno_ids)
    into v_capacidade, v_ocupacao
    from public.turmas where id = p_turma_id for update;
    if not found then raise exception 'Turma não encontrada'; end if;
    if v_ocupacao >= v_capacidade then raise exception 'A turma atingiu a capacidade máxima'; end if;
    update public.turmas
    set aluno_ids = case when p_aluno_id = any(aluno_ids) then aluno_ids else array_append(aluno_ids, p_aluno_id) end
    where id = p_turma_id;
  end if;

  update public.alunos set turma_id = p_turma_id where id = p_aluno_id;
end;
$$;

revoke all on function public.vincular_aluno_turma(uuid, uuid) from public;
grant execute on function public.vincular_aluno_turma(uuid, uuid) to authenticated;

-- ── Alertas de ficha ausente ou desatualizada ───────────────────────────────

create or replace view public.alertas_treino
with (security_invoker = true)
as
select
  a.id as aluno_id,
  a.nome as aluno_nome,
  a.professor_id,
  max(t.updated_at) as ultima_atualizacao,
  case when count(t.id) = 0 then 'sem_ficha' else 'revisao' end as tipo
from public.alunos a
left join public.treinos t on t.aluno_id = a.id
where a.status = 'ativo'
group by a.id, a.nome, a.professor_id
having count(t.id) = 0 or max(t.updated_at) < now() - interval '45 days';

grant select on public.alertas_treino to authenticated;
