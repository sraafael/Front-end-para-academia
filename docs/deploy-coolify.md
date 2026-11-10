# Publicar o FitPro no Coolify

O Coolify hospeda o frontend React compilado, servido pelo Nginx. O navegador
continua acessando o Supabase pela internet: banco, Auth, Storage e Edge Functions
permanecem no projeto atual. Não é necessário instalar outro banco no Compose,
copiar dados nem reaplicar migrações para mudar apenas a hospedagem do front.

## Preparar o repositório

Envie para o GitHub o Dockerfile, os dois arquivos Compose, a pasta `docker`,
`.dockerignore`, `.env.example` e esta documentação. O Coolify precisa ler uma
branch que contenha esses arquivos. Não envie seu `.env`.

## Configurar no Coolify

1. No projeto e ambiente desejados, crie uma aplicação a partir do repositório
   `https://github.com/sraafael/Front-end-para-academia`.
2. Selecione a branch com os arquivos e a estratégia **Docker Compose**.
3. Use **Base Directory** `/` e **Docker Compose Location** `/docker-compose.yml`.
4. Salve e carregue a definição. Em **Environment Variables**, preencha:

   | Variável | Valor |
   | --- | --- |
   | `VITE_SUPABASE_URL` | URL HTTPS do projeto Supabase atual |
   | `VITE_SUPABASE_ANON_KEY` | Chave pública `anon` do mesmo projeto |

   Os valores atuais estão em `utils/supabase/info.tsx`: a URL é
   `https://<projectId>.supabase.co` e a chave é `publicAnonKey`.
   As variáveis precisam estar disponíveis durante o **build**; o Compose as
   passa como argumentos ao Dockerfile. Se a interface oferecer a opção de
   variável de build, habilite-a. O Vite incorpora esses valores ao JavaScript:
   eles são públicos. Nunca use `service_role`, chave secret ou senha do banco.
5. Em **Domains**, associe seu domínio ao serviço **frontend**, porta interna
   **80** (por exemplo, `https://academia.seudominio.com:80`). A porta indica o
   destino interno do proxy; o usuário acessa HTTPS normalmente, sem `:80`.
   Aponte o DNS do domínio para o servidor Coolify, ou utilize um domínio de
   teste oferecido pela sua instalação.
6. Clique em **Deploy** e acompanhe os logs. O container possui uma verificação
   de saúde em `/health`. O HTTPS público é administrado pelo proxy do Coolify.

Ao alterar as variáveis do Supabase, faça um novo build/deploy. Apenas reiniciar
o container não altera o JavaScript já compilado.

## Configurações no Supabase

- Mantenha o mesmo projeto e as Edge Functions já publicadas. O Compose não
  publica funções nem executa migrações.
- Em **Authentication → URL Configuration**, ajuste **Site URL** para o novo
  endereço. Caso utilize fluxos com redirecionamento, cadastre também os URLs
  de retorno exatos em **Redirect URLs**. O login atual por CPF/senha não depende
  de um redirecionamento OAuth.
- Se o Pix estiver ativo, atualize o segredo **FITPRO_APP_URL** das Edge Functions
  para o novo endereço do frontend. Confira o [guia do Pix](pix-mercado-pago.md).
  O callback `MP_OAUTH_REDIRECT_URI` continua sendo o endpoint da função no
  Supabase; mudar só o frontend não exige mover esse callback.
- Os segredos do Mercado Pago e as chaves administrativas continuam somente no
  Supabase. As permissões dos dados continuam sendo controladas pelas políticas
  RLS do projeto, independentemente da hospedagem do frontend.

## Testar com Docker na sua máquina

```bash
cp .env.example .env
# Preencha .env com a URL e a chave pública do projeto atual.
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

Acesse `http://localhost:8080`. O complemento local publica a porta somente em
localhost. No Coolify, utilize apenas `docker-compose.yml`, pois o proxy cuida
do acesso público.

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml down
```

Após o deploy, confira `/health`, login, abertura direta de uma rota interna,
atualização da página e leitura de dados. Se usar Pix, valide também o retorno
da conexão com o Mercado Pago. A saúde do Nginx não comprova a saúde do Supabase.

Referências: [Docker Compose no Coolify](https://coolify.io/docs/applications/builds/docker-compose)
e [URLs de redirecionamento no Supabase](https://supabase.com/docs/guides/auth/redirect-urls).
