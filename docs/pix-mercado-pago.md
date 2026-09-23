# Pix opcional por academia

O Pix é **desligado por padrão**. A administração de cada academia conecta sua própria conta Mercado Pago e decide se quer ativar a cobrança no aplicativo. O sistema não calcula nem retém comissão; a mensalidade é criada com o token da conta autorizada pela academia. Isso não elimina eventuais tarifas cobradas pelo próprio Mercado Pago. O aluguel mensal do sistema para a academia é um contrato separado e não faz parte desta integração.

> `pnpm dev` continua apontando para o Supabase principal configurado em `utils/supabase/info.tsx`. Para testar sem usá-lo, execute o modo isolado descrito abaixo.

## Estado da publicação

Em 23/09/2026, as duas migrações Pix e as funções `pix-connect`, `pix-charge` e `pix-webhook` foram aplicadas ao projeto Supabase `gdwwpxvedoortnjfrgej`. As migrações foram executadas individualmente, sem usar `db push`, porque o projeto remoto não tinha histórico de migrações da CLI. Não rode `db push` nesse projeto sem antes conciliar esse histórico.

O servidor está fixado em `FITPRO_PIX_TEST_MODE=true` e retorna ao aplicativo em `http://localhost:8443`. Não há conta de academia conectada nem credenciais Mercado Pago configuradas no Supabase. Portanto, o Pix continua indisponível aos alunos; isso é intencional até concluir a configuração comercial e testar o fluxo completo. O retorno local funciona somente no computador que abre o aplicativo nessa porta.

## Teste local isolado

1. Inicie um Supabase local com Docker e a CLI em uma **pasta separada**. Neste projeto, `supabase/schema.sql` é o esquema inicial e deve ser aplicado antes dos arquivos de `supabase/migrations/`. Não use `supabase db reset --linked`: essa opção atua no projeto remoto vinculado.
2. Copie `.env.pix-test.example` para `.env.pix-test.local` e preencha a URL e a chave **pública** mostradas pelo Supabase local. Nunca use a chave `service_role` no navegador.
3. Execute `pnpm dev:pix` e abra `http://127.0.0.1:8444`. Esse modo recusa a URL ou a chave pública do projeto principal. O `pnpm dev` normal permanece inalterado.
4. Sirva as Edge Functions a partir da mesma pasta e rede Docker do banco local. Use somente contas, CPFs e planos fictícios.

O ambiente local permite conferir telas, permissões e migrações sem alterar o Supabase principal. Para testar **OAuth e webhook** com o Mercado Pago, ainda será necessário um endereço HTTPS público para o retorno e as notificações: um projeto Supabase de testes separado ou um túnel temporário autorizado. Não exponha o serviço local à internet sem essa escolha.

### Túnel temporário para o Mercado Pago

Esta é a opção mais curta para um teste acompanhado, sem publicar o banco principal. O token de **teste** valida a API de Orders, mas a conexão OAuth das academias usa `Client ID` e `Client Secret`, disponíveis na área de credenciais de produção do Mercado Pago. A ativação dessa área pede dados do negócio e um site; não faça isso apenas para executar a simulação da API. Com essas credenciais OAuth autorizadas e disponíveis:

1. Mantenha o Supabase local e as funções em execução. Inicie `node scripts/pix-tunnel-proxy.mjs` em outro terminal. A porta `127.0.0.1:8450` aceita somente o retorno OAuth e o webhook; não encaminha páginas, banco nem ações administrativas.
2. Inicie um [Quick Tunnel do Cloudflare](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/) apontando para `http://127.0.0.1:8450`. Neste computador, o comando testado foi `docker run --rm --network host cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://127.0.0.1:8450`. Ele mostra uma URL HTTPS temporária, como `https://EXEMPLO.trycloudflare.com`.
3. Cadastre `https://EXEMPLO.trycloudflare.com/functions/v1/pix-connect` como retorno OAuth e `https://EXEMPLO.trycloudflare.com/functions/v1/pix-webhook` como webhook de **orders** no aplicativo de teste do Mercado Pago. Use a primeira URL também em `MP_OAUTH_REDIRECT_URI` nas funções locais.
4. No arquivo `supabase/functions/.env` da **cópia local de testes**, configure `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_WEBHOOK_SECRET`, `FITPRO_APP_URL=http://127.0.0.1:8444`, `FITPRO_PIX_TEST_MODE=true` e uma `FITPRO_PIX_ENCRYPTION_KEY` aleatória. Não copie esse arquivo para o projeto principal nem para o Git. Reinicie as funções após alterar os segredos.
5. Ao terminar, encerre o túnel e o proxy. O endereço público muda quando o Quick Tunnel é reiniciado; atualize o retorno OAuth e o webhook antes de outro teste. Não use esse túnel temporário em produção.

Não coloque credenciais em arquivos `VITE_`: esses valores são enviados ao navegador. Sem `Client ID` e `Client Secret`, ainda é possível validar uma order simulada diretamente com o Access Token de teste, conforme a [documentação oficial](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix). Esse teste isolado não valida a conexão OAuth nem o webhook do aplicativo.

## Antes de liberar a função

1. Aplicar as migrações `20260922170000_optional_academy_pix.sql` e `20260923100000_pix_test_safety.sql` no projeto Supabase, se ainda não estiverem aplicadas. No projeto `gdwwpxvedoortnjfrgej`, essa etapa já foi concluída.
2. Criar uma aplicação no Mercado Pago com OAuth para contas de terceiros. A conta recebedora de cada academia precisa ter uma chave Pix cadastrada. Registrar como URL de redirecionamento `https://SEU-PROJETO.supabase.co/functions/v1/pix-connect`. O endereço precisa corresponder exatamente ao configurado no Mercado Pago.
3. Configurar o webhook de **orders** em `https://SEU-PROJETO.supabase.co/functions/v1/pix-webhook` e guardar a chave de assinatura.
4. Configurar os segredos das funções no Supabase, sem colocá-los no código, no navegador ou no Git:

   - `MP_CLIENT_ID` e `MP_CLIENT_SECRET`: dados da aplicação Mercado Pago.
   - `MP_OAUTH_REDIRECT_URI`: URL do passo 2.
   - `MP_WEBHOOK_SECRET`: chave do passo 3.
   - `FITPRO_APP_URL`: endereço base do aplicativo, por exemplo `http://localhost:8443` durante os testes locais.
   - `FITPRO_PIX_ENCRYPTION_KEY`: chave aleatória de **32 bytes codificados em Base64** para proteger os tokens das academias.
   - `FITPRO_PIX_TEST_MODE=true`: recomendado até terminar a validação. Só depois de testar todo o fluxo e obter aprovação para produção, usar `false` e reconectar cada academia.

5. Publicar as funções `pix-connect`, `pix-charge` e `pix-webhook`, se ainda não estiverem publicadas. No projeto `gdwwpxvedoortnjfrgej`, essa etapa já foi concluída. `pix-connect` e `pix-webhook` aceitam chamadas sem JWT para receber o retorno OAuth e as notificações, mas validam, respectivamente, o estado temporário e a assinatura do provedor. `pix-charge` exige a sessão do aluno.

## Fluxo esperado

1. O administrador abre **Pix da Academia**, conecta a conta dele e ativa a opção.
2. O aluno com e-mail válido, plano ativo e vencimento definido gera o Pix da mensalidade. O valor vem do plano no servidor, não do navegador.
3. O aplicativo mostra o QR Code ou o Pix copia e cola. Se o Mercado Pago ainda estiver processando a order, a tela aguarda e consulta novamente até receber as instruções. Gerar o código **não** quita a mensalidade.
4. O servidor confere a order no Mercado Pago. Só após confirmação de pagamento **real** acreditado é que registra a receita e avança o vencimento. Uma simulação aprovada nunca quita a mensalidade nem cria receita. Se a mensalidade for alterada manualmente enquanto um Pix real estiver em aberto, a cobrança fica marcada para conferência, sem novo lançamento automático.
5. Ao desligar a opção, os novos Pix deixam de ser oferecidos; cobranças já abertas continuam sujeitas à conciliação.

## Conferência manual antes de usar dinheiro real

- Entrar como administrador de uma academia de teste, conectar uma **conta de teste** e ativar o Pix.
- Entrar como aluno de teste com plano, gerar a simulação de R$ 50,00 e confirmar que a mensalidade continua pendente. O Mercado Pago usa `payer.first_name=APRO` para aprovar automaticamente a order de teste; **não** pague o QR Code nem tente simular uma compra pelo aplicativo bancário. Consulte a [documentação oficial do teste Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix).
- Conferir se o webhook é aceito, se a simulação fica aprovada e se **nenhuma** mensalidade ou receita real é alterada.
- Reenviar a mesma notificação e confirmar que não há receita duplicada.
- Desativar o Pix e conferir que o pagamento manual continua disponível.
- Testar separadamente, antes da produção, a confirmação e a idempotência da cobrança **real**. Conferir a marcação `review` se a mensalidade for paga manualmente enquanto houver um Pix real em aberto.

Não habilitar cobranças reais sem validar OAuth, webhook, renovação de token, expiração e devoluções com contas de teste. A aplicação ainda não automatiza estornos ou disputas: esses casos devem ser conferidos no Mercado Pago e reconciliados pela academia.
