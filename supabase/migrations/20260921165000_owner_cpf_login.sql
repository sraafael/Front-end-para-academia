-- Mantém o login do proprietário por CPF sem gravar o número no aplicativo.

begin;

create or replace function public.resolve_fitpro_owner_login_email(p_cpf text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(users.email)
  from public.academy_admins admins
  join auth.users users on users.id = admins.user_id
  where admins.cpf = p_cpf
    and admins.is_owner = true
    and admins.status = 'ativo'
    and p_cpf ~ '^[0-9]{11}$'
  limit 1;
$$;

revoke all on function public.resolve_fitpro_owner_login_email(text) from public;
grant execute on function public.resolve_fitpro_owner_login_email(text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
