-- Dados informativos para conferir a conta Mercado Pago autorizada pela academia.
-- O destino do dinheiro é definido pela autorização OAuth, nunca por estes campos.
alter table public.academies
  add column if not exists pix_titular_nome text not null default '',
  add column if not exists pix_titular_documento text not null default '';
