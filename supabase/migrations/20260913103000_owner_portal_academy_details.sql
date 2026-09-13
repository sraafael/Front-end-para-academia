-- Amplia o cadastro de academias para o portal exclusivo do proprietário.

begin;

alter table public.academies
  add column if not exists inscricao_estadual text not null default '',
  add column if not exists inscricao_municipal text not null default '',
  add column if not exists responsavel_legal text not null default '',
  add column if not exists whatsapp text not null default '',
  add column if not exists horario_semana text not null default '',
  add column if not exists horario_sabado text not null default '',
  add column if not exists horario_domingo text not null default '',
  add column if not exists observacoes text not null default '';

comment on column public.academies.responsavel_legal is 'Pessoa responsável legalmente pela unidade';
comment on column public.academies.horario_semana is 'Horário de funcionamento de segunda a sexta';
comment on column public.academies.horario_sabado is 'Horário de funcionamento aos sábados';
comment on column public.academies.horario_domingo is 'Horário de funcionamento aos domingos e feriados';

commit;
