# Pix da apresentação com conta única do proprietário

No modo atual de apresentação, o proprietário autoriza uma vez a própria conta
Mercado Pago. Todas as academias atuais e futuras ficam vinculadas a essa conta
e os pagamentos são recebidos por ela. A credencial OAuth é guardada uma única
vez em `owner_pix_connections`; as unidades armazenam somente a ativação.

Esse arranjo é temporário para o TCC. Antes de operar com academias reais de
terceiros, volte ao modelo em que cada academia autoriza a própria conta.

## Modelo original por academia

O Pix é **desligado por padrão**. O proprietário do FitPro cadastra a academia, envia um link temporário ao representante dela e, depois da autorização, confere a conta Mercado Pago e ativa o Pix. O representante precisa entrar na própria conta Mercado Pago; o proprietário não deve pedir senha ou código. Em produção, a mensalidade é criada com o token da conta autorizada pela academia; o sistema não calcula nem retém comissão. Isso não elimina eventuais tarifas cobradas pelo próprio Mercado Pago. O aluguel mensal do sistema para a academia é um contrato separado e não faz parte desta integração.

## Estado atual

Em 25/09/2026, o proprietário realizou um Pix real de R$ 5,00 na academia de demonstração. Confirmou o recebedor no aplicativo bancário, informou o recebimento líquido de R$ 4,95 após a tarifa do Mercado Pago e viu a mensalidade do aluno como “Em dia” no FitPro. Essa validação demonstra o fluxo da academia conectada, mas não substitui a conferência periódica de estornos, disputas e falhas de webhook.

O modo de produção no servidor depende de `FITPRO_PIX_TEST_MODE=false`, da chave do webhook de produção e de autorização OAuth da conta recebedora. O Pix deve ser ativado individualmente para cada academia. Os dados do titular cadastrados no painel servem apenas para conferência: não redirecionam o dinheiro. O recebedor é a conta Mercado Pago que autorizou o vínculo.

As migrações Pix foram aplicadas individualmente ao projeto Supabase `gdwwpxvedoortnjfrgej`, pois o histórico remoto da CLI não estava conciliado. Não execute `db push` nesse projeto sem antes verificar esse histórico.

## Configuração da integração

1. Aplicar as migrações `20260922170000_optional_academy_pix.sql` e `20260923100000_pix_test_safety.sql` no projeto Supabase, se ainda não estiverem aplicadas. No projeto `gdwwpxvedoortnjfrgej`, essa etapa já foi concluída.
2. Criar uma aplicação no Mercado Pago com OAuth para contas de terceiros. A conta recebedora de cada academia precisa ter uma chave Pix cadastrada. Registrar como URL de redirecionamento `https://SEU-PROJETO.supabase.co/functions/v1/pix-connect`. O endereço precisa corresponder exatamente ao configurado no Mercado Pago.
3. Configurar o webhook de **orders** em `https://SEU-PROJETO.supabase.co/functions/v1/pix-webhook`. Guardar separadamente as chaves de assinatura de cada ambiente.
4. Configurar os segredos das funções no Supabase, sem colocá-los no código, no navegador ou no Git:

   - `MP_CLIENT_ID` e `MP_CLIENT_SECRET`: dados da aplicação Mercado Pago.
   - `MP_OAUTH_REDIRECT_URI`: URL do passo 2.
   - `MP_WEBHOOK_SECRET`: chave do webhook de teste do passo 3 (mantida por compatibilidade; `MP_TEST_WEBHOOK_SECRET` também é aceita).
   - `MP_PROD_WEBHOOK_SECRET`: chave do webhook de produção. Sem ela, a função não libera cobranças reais.
   - `FITPRO_APP_URL`: endereço base do aplicativo publicado.
   - `FITPRO_PIX_ENCRYPTION_KEY`: chave aleatória de **32 bytes codificados em Base64** para proteger os tokens das academias.
   - `FITPRO_PIX_TEST_MODE=false`: habilita cobranças reais. O código mantém a separação do modo simulado para impedir que uma simulação quite uma mensalidade real.

5. Publicar as funções `pix-connect`, `pix-charge` e `pix-webhook`, se ainda não estiverem publicadas. No projeto `gdwwpxvedoortnjfrgej`, essa etapa já foi concluída. `pix-connect` e `pix-webhook` aceitam chamadas sem JWT para receber o retorno OAuth e as notificações, mas validam, respectivamente, o estado temporário e a assinatura do provedor. `pix-charge` exige a sessão do aluno.

## Fluxo esperado

1. O proprietário abre a academia em **Gerenciar academias**, preenche os dados de conferência do titular e envia o link temporário ao representante autorizado.
2. O representante entra na própria conta Mercado Pago e autoriza a conexão. O proprietário confere o ID da conta vinculada e ativa o Pix para a academia. A administração só consulta o status e continua com os pagamentos manuais quando o Pix estiver desligado.
3. O aluno com e-mail válido, plano ativo e vencimento definido gera o Pix da mensalidade. O valor vem do plano no servidor, não do navegador.
4. O aplicativo mostra o QR Code ou o Pix copia e cola. Se o Mercado Pago ainda estiver processando a order, a tela aguarda e consulta novamente até receber as instruções. Gerar o código **não** quita a mensalidade.
5. O servidor confere a order no Mercado Pago. Só após confirmação de pagamento **real** acreditado é que registra a receita e avança o vencimento. Se a mensalidade for alterada manualmente enquanto um Pix real estiver em aberto, a cobrança fica marcada para conferência, sem novo lançamento automático.
6. Ao desligar a opção, os novos Pix deixam de ser oferecidos; cobranças já abertas continuam sujeitas à conciliação.

## Conciliação automática

O webhook é o caminho principal. Como proteção adicional, a função `pix-reconcile` consulta a cada cinco minutos até 12 cobranças reais abertas que já têm uma order no Mercado Pago. Ela começa pelas que estão há mais tempo sem conferência e usa a mesma validação e confirmação única do webhook. A consulta não cria uma nova cobrança.

No projeto principal `gdwwpxvedoortnjfrgej`, a migração, a função e os segredos da conciliação foram configurados em 28/09/2026. Uma execução manual e uma execução do agendamento responderam HTTP 200 com `checked: 0` e `errors: 0`, pois não havia cobrança real pendente para conferir. Uma chamada sem o segredo recebeu HTTP 401. Isso valida a execução e a proteção da rotina, mas a atualização automática de uma **nova** cobrança pendente ainda precisa ser observada no próximo pagamento real.

Ainda em 28/09/2026, um segundo aluno de demonstração pagou R$ 5,00 em produção. A cobrança passou de `pending` para `paid`, o vencimento avançou para 28/10/2026 e foi criado exatamente um lançamento de receita de R$ 5,00. O campo `last_reconciled_at` permaneceu vazio: o pagamento foi reconhecido antes de uma rodada do agendamento. Como a página do aluno estava aberta, esse ensaio não comprova isoladamente a baixa pelo job de cinco minutos com o navegador fechado.

Para ativar no Supabase principal:

1. Aplique `20260925120000_schedule_pix_reconciliation.sql` depois das demais migrações Pix. No projeto principal, essa migração já foi aplicada individualmente porque o histórico remoto da CLI ainda não está conciliado; não use `db push` ali sem verificar esse histórico.
2. Publique `pix-reconcile` com verificação de JWT desligada, conforme `supabase/config.toml`. A função exige um segredo próprio no cabeçalho; não deve ser chamada pelo navegador.
3. Gere um segredo aleatório de pelo menos 32 caracteres. Guarde-o como `FITPRO_PIX_RECONCILE_SECRET` nos segredos das Edge Functions e com o nome `fitpro_pix_reconcile_secret` no Supabase Vault. Guarde também a URL `https://SEU-PROJETO.supabase.co` no Vault, com o nome `fitpro_pix_reconcile_url`. Nunca coloque o segredo no Git, no frontend ou neste documento.
4. Confira no painel do Supabase se o job `fitpro-pix-reconcile` executa, se a função registra `checked` e `errors` sem falhas, e se uma cobrança real pendente muda de estado após a confirmação no Mercado Pago. `last_reconciled_at` mostra a última conferência; uma cobrança sem ID de order precisa de análise separada e não é quitada por esta rotina.

Se a chave ou a URL estiver ausente, o agendamento não chama a função. Se o servidor estiver em modo de teste, a função recusa a conciliação real. Isso impede que a implantação parcial altere mensalidades.

## Histórico para a academia

Em **Financeiro > Histórico Pix**, o administrador consulta as 50 cobranças mais recentes da própria academia. A lista mostra aluno, nome do plano no momento da cobrança, valor bruto, vencimento, datas, status e identificadores da cobrança e do Mercado Pago. O filtro de status e o botão **Atualizar** ajudam a conferir pagamentos pendentes ou em revisão. O valor mostrado não é o líquido recebido após as tarifas do provedor.

O nome do plano passou a ser guardado em cada nova cobrança. Nas cobranças anteriores, o nome foi preenchido com o plano que o aluno tinha durante a migração; por isso, esse dado antigo pode não reproduzir uma troca de plano ocorrida no passado. A migração `20260928130000_pix_charge_plan_snapshot.sql` e as funções `pix-connect` e `pix-charge` foram aplicadas ao projeto principal em 28/09/2026.

No mesmo dia, um ensaio de isolamento criou uma segunda academia e registros temporários dentro de transações com `rollback`. Administrador, professor e aluno da academia de demonstração não conseguiram ler os registros da outra academia. A tentativa do administrador de alterar um plano da outra academia afetou zero linhas. Nenhum dado do ensaio permaneceu no banco.

## Operação

Para a apresentação do TCC, a conta Mercado Pago do proprietário pode ficar conectada somente à academia de demonstração. O professor paga pelo próprio celular ao ler o QR Code exibido no perfil do aluno; ele não precisa de cadastro financeiro. Para as demais academias, cada representante autoriza a própria conta e o proprietário ativa o Pix separadamente.

Confira periodicamente no Mercado Pago o recebimento, eventuais estornos e disputas. A aplicação ainda não concilia automaticamente esses casos. Se um pagamento manual ocorrer enquanto houver Pix em aberto, confira a cobrança marcada para revisão antes de fazer qualquer ajuste financeiro.
