-- Alinha a gestão de planos ao cadastro atual de administradores da academia.

begin;

alter table public.planos enable row level security;
grant select, insert, update, delete on table public.planos to authenticated;

-- Remove regras antigas que consultavam a tabela legada public.admins.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'planos'
  loop
    execute format('drop policy if exists %I on public.planos', policy_row.policyname);
  end loop;
end
$$;

create policy "planos: authenticated read"
on public.planos for select to authenticated
using (true);

create policy "planos: admin insert"
on public.planos for insert to authenticated
with check (public.is_fitpro_admin());

create policy "planos: admin update"
on public.planos for update to authenticated
using (public.is_fitpro_admin())
with check (public.is_fitpro_admin());

create policy "planos: admin delete"
on public.planos for delete to authenticated
using (public.is_fitpro_admin());

commit;
