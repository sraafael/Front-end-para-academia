# Roteiro de validação para o TCC

Use uma academia e contas fictícias em um ambiente controlado. Prepare os dados antes da apresentação e não mostre senhas ou documentos reais na tela.

## Demonstração sugerida

| Etapa | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Entrar como administrador com CPF e senha. | Abre somente o painel administrativo. |
| 2 | Cadastrar um professor e um aluno fictícios. | Gera acesso temporário e lista os novos perfis. |
| 3 | Tentar repetir CPF, telefone ou e-mail. | Mostra qual campo já está cadastrado, sem duplicar o registro. |
| 4 | Abrir o perfil do professor e redefinir a senha. | Exige nova troca no próximo acesso e registra a ação na auditoria. |
| 5 | Entrar como professor e vincular uma ficha ao aluno. | O professor vê apenas os alunos permitidos. |
| 6 | Entrar como aluno, marcar uma série na aba Terça e atualizar o peso. | A aba continua selecionada; série e peso ficam visíveis. |
| 7 | Voltar à administração e abrir a auditoria. | Mostra autor, ação e horário das alterações. |

## Evidências que vale guardar

- Capturas das telas antes e depois das etapas principais, sem dados pessoais reais.
- Anotações dos resultados observados em cada etapa e de eventuais erros.
- Saída de `pnpm typecheck` e `pnpm build`, se quiser registrar a integridade da compilação.
- Lista curta de limitações conhecidas e melhorias futuras.

## Conferência da segurança do banco

Para avaliar a proteção real dos dados, entre com contas de **duas academias fictícias** e tente ler ou alterar registros da outra unidade como administrador, professor e aluno. O resultado esperado é acesso negado ou lista vazia, sem alterar dados. Repita esse roteiro após mudanças nas políticas RLS. Prefira um ambiente separado para essa conferência.
