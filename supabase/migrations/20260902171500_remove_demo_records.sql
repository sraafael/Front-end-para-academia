-- Remove somente os registros identificados como dados de demonstração.
-- A auditoria e todos os cadastros reais são preservados.

begin;

delete from public.transacoes
where descricao like '[DEMO]%';

-- A exclusão dos alunos remove em cascata históricos de peso, frequências,
-- fichas, exercícios e séries vinculados exclusivamente a eles.
delete from public.alunos
where nome like '[DEMO]%';

delete from public.turmas
where nome like '[DEMO]%';

delete from public.professores
where nome like '[DEMO]%';

delete from public.planos
where nome like '[DEMO]%';

commit;
