-- Remove a conta incompleta criada ao tentar cadastrar o CPF do proprietário
-- antes da instalação da estrutura de administradores.

begin;

delete from auth.users
where lower(email) = 'admin.54514214809@fitpro.internal'
  and lower(email) <> 'admin@fitpro.internal';

commit;
