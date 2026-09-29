-- Guarda o nome do plano cobrado para o histórico não mudar se o cadastro for editado.
alter table public.pix_charges
  add column if not exists plan_name text;

update public.pix_charges charge
set plan_name = plan.nome
from public.alunos student
join public.planos plan on plan.id = student.plano_id
where charge.aluno_id = student.id
  and charge.academy_id = student.academy_id
  and plan.academy_id = charge.academy_id
  and charge.plan_name is null;
