-- Pedidos de recuperação feitos por alunos, separados por academia.
begin;

create table public.student_password_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);

create unique index student_recovery_one_pending_per_aluno
  on public.student_password_recovery_requests (aluno_id) where status = 'pending';
create index student_recovery_academy_pending
  on public.student_password_recovery_requests (academy_id, created_at desc) where status = 'pending';

alter table public.student_password_recovery_requests enable row level security;
revoke all on public.student_password_recovery_requests from public, anon, authenticated;
grant all on public.student_password_recovery_requests to service_role;

-- A decisão e a troca de senha acontecem juntas, somente pelo servidor.
create function public.handle_fitpro_student_recovery(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_action text,
  p_temporary_password text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_actor_academy_id uuid;
  v_actor_email text;
  v_request public.student_password_recovery_requests%rowtype;
  v_aluno public.alunos%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Operação permitida apenas ao servidor' using errcode = '42501';
  end if;
  if p_action not in ('reset', 'dismiss') then raise exception 'Ação inválida'; end if;

  select academy_id into v_actor_academy_id
  from public.academy_admins
  where user_id = p_actor_user_id and status = 'ativo' and is_owner = false;
  if not found or v_actor_academy_id is null then
    raise exception 'Apenas a administração da academia pode tratar este pedido' using errcode = '42501';
  end if;

  select * into v_request from public.student_password_recovery_requests
  where id = p_request_id for update;
  if not found or v_request.status <> 'pending' or v_request.academy_id <> v_actor_academy_id then
    raise exception 'Pedido não encontrado ou já tratado' using errcode = '42501';
  end if;

  select * into v_aluno from public.alunos where id = v_request.aluno_id for update;
  if not found or v_aluno.academy_id <> v_request.academy_id then
    raise exception 'Aluno deste pedido não encontrado';
  end if;
  select email into v_actor_email from auth.users where id = p_actor_user_id;

  if p_action = 'reset' then
    if length(coalesce(p_temporary_password, '')) < 16 then
      raise exception 'A senha temporária deve ter pelo menos 16 caracteres';
    end if;
    if v_aluno.status = 'inativo' or v_aluno.user_id is null then
      raise exception 'O aluno precisa ter uma conta de acesso ativa';
    end if;
    update auth.users
    set encrypted_password = crypt(p_temporary_password, gen_salt('bf')), updated_at = now()
    where id = v_aluno.user_id;
    if not found then raise exception 'Conta de acesso do aluno não encontrada'; end if;
    delete from auth.sessions where user_id = v_aluno.user_id;
    update public.alunos set is_first_login = true where id = v_aluno.id;
  end if;

  update public.student_password_recovery_requests
  set status = case when p_action = 'reset' then 'resolved' else 'dismissed' end,
      handled_at = now(), handled_by = p_actor_user_id
  where id = p_request_id;

  insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, label, details)
  values (p_actor_user_id, coalesce(v_actor_email, 'sistema'),
          case when p_action = 'reset' then 'password_reset' else 'update' end,
          'student_password_recovery_requests', p_request_id, v_aluno.nome,
          jsonb_build_object('academy_id', v_request.academy_id, 'aluno_id', v_aluno.id, 'decision', p_action));

  return jsonb_build_object('nome', v_aluno.nome, 'cpf', v_aluno.cpf);
end;
$$;

revoke all on function public.handle_fitpro_student_recovery(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.handle_fitpro_student_recovery(uuid, uuid, text, text) to service_role;

notify pgrst, 'reload schema';
commit;
