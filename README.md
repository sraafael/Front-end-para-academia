# FitPro

Sistema web de gestão de academia desenvolvido como Trabalho de Conclusão de Curso. Reúne rotinas da administração, professores e alunos em uma aplicação React ligada ao Supabase.

## O que cada perfil faz

| Perfil | Principais tarefas |
| --- | --- |
| Proprietário | Cadastrar academias e definir administradores. |
| Administração | Gerenciar alunos, professores, turmas, planos, mensalidades e relatórios. |
| Professor | Consultar alunos vinculados, organizar treinos e registrar presença. |
| Aluno | Consultar e marcar séries, acompanhar peso, frequência e mensalidade. |

O acesso usa **CPF e senha**. O CPF é convertido para uma identificação interna do Supabase Auth; a senha não é guardada no código da aplicação. No primeiro acesso, o usuário troca a senha temporária.

## Como o projeto está organizado

- `src/app/routes.tsx`: páginas e proteção por perfil.
- `src/components/`: telas e formulários.
- `src/store/`: sessão e dados exibidos nos painéis.
- `src/api/`: chamadas ao Supabase e às funções do servidor.
- `supabase/migrations/`: evolução do banco, funções SQL e políticas de acesso.
- `supabase/functions/`: criação de contas e redefinição de senha no servidor.

O navegador consulta os dados pelo Supabase. As políticas de segurança do banco (RLS) restringem o acesso conforme o perfil e a academia. Operações sensíveis de criação de contas e redefinição de senha passam pelas Edge Functions, que validam o administrador antes de usar privilégios de servidor. Alterações administrativas são registradas em `audit_logs`.

## Requisitos e execução

- Node.js 22 e pnpm (versões indicadas em `.mise.toml`).
- Acesso ao projeto Supabase configurado em `utils/supabase/info.tsx` para usar os dados reais.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Abra o endereço informado pelo Vite. A chave presente em `utils/supabase/info.tsx` é a chave **pública** do cliente; nunca coloque uma chave `service_role` no frontend ou em arquivos versionados. As Edge Functions recebem os segredos no ambiente do Supabase.

Esta cópia do frontend aponta para um projeto Supabase específico. Para reproduzir a instalação em outro projeto, é preciso configurar outro identificador/chave pública, aplicar e verificar as migrações SQL e publicar as Edge Functions. O arquivo `supabase/schema.sql` é uma referência do esquema inicial; as migrações posteriores também fazem parte do estado atual. Não aplique os scripts diretamente em um banco com dados importantes sem antes fazer backup e validar a ordem das alterações.

## Conferência do código

```bash
pnpm typecheck
pnpm build
```

Esses comandos verificam os tipos e a compilação da aplicação. A validação de cada fluxo pode ser feita manualmente, usando perfis fictícios.

## Demonstração e limites

O [roteiro de validação](docs/roteiro-validacao.md) sugere uma apresentação curta para a banca e uma conferência manual dos fluxos. Evite usar CPF, telefone, e-mail ou senha de pessoas reais na demonstração.

O pagamento Pix opcional por academia já tem tabelas e funções publicadas no Supabase, mas continua desligado e em modo de teste. Ainda faltam as credenciais do Mercado Pago e a validação de uma cobrança completa. O [guia do Pix](docs/pix-mercado-pago.md) mostra o estado atual e o que falta para ativá-lo. A recuperação de acesso encaminha uma solicitação à administração; ela não redefine a senha automaticamente. A segurança das políticas RLS e dos fluxos reais de autenticação precisa continuar sendo verificada sempre que o esquema do banco mudar.
