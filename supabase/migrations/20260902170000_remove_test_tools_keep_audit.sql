-- Remove todas as ferramentas de teste e preserva a auditoria automática.

begin;

drop function if exists public.reset_test_environment();
drop function if exists public.generate_demo_data();
drop function if exists public.reset_test_environment_internal();
drop function if exists public.generate_demo_data_internal();

commit;
