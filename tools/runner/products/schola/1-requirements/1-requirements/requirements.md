### requirements.md

#### Visão do Produto
O Schola é um sistema de gerenciamento de turmas para o curso de ProdOps, permitindo que os alunos vejam as turmas disponíveis, solicitem matrícula e tenham a matrícula confirmada após pagamento.

#### Objetivos
1. Permitir aos alunos visualizar turmas abertas do curso de ProdOps.
2. Permitir aos alunos solicitar matrícula em uma turma específica.
3. Automatizar o processo de confirmação da matrícula após pagamento.

#### Escopo
O Schola gerenciará as seguintes funcionalidades:
- Autenticação dos usuários através do Certificare.
- Listagem das turmas abertas do curso de ProdOps.
- Solicitação de matrícula por parte do aluno.
- Confirmação da matrícula após pagamento.

#### Fora de Escopo
O Schola não inclui o cadastro de usuário e login, que são responsabilidade do Certificare.

#### Personas
1. Aluno: utiliza o sistema para visualizar turmas abertas, solicitar matrícula e acompanhar a confirmação da matrícula.
2. Admin ProdOps: cria e gerencia as turmas no sistema.

#### Jornadas do Usuário

- **Jornada 1:** O aluno loga no Schola com o Certificare e visualiza as turmas abertas.
- **Jornada 2:** O aluno solicita matrícula em uma turma específica, que é registrada no sistema.
- **Jornada 3:** Após pagamento, o sistema recebe a confirmação de pagamento via API e confirma a matrícula do aluno.

#### Requisitos Funcionais

RF-001: Redirecionar para login e cadastro usando Certificare e receber retorno autenticado.
	* Critérios de aceitação:
		+ O usuário é redirecionado para o login do Certificare.
		+ Após autenticação, o sistema retorna a página inicial com acesso liberado.

RF-002: Listar turmas do curso de ProdOps que estão abertas para matrícula.
	* Critérios de aceitação:
		+ A lista de turmas é exibida na tela com as informações necessárias (nome, data, horário).
		+ O usuário pode filtrar ou ordenar a lista se necessário.

RF-003: Permitir que um usuário autenticado solicite matrícula em uma turma.
	* Critérios de aceitação:
		+ A opção para solicitar matrícula está disponível na página das turmas.
		+ O sistema registra a solicitação de matrícula e envia notificação ao admin ProdOps.

RF-004: Permitir consultar status da matrícula.
	* Critérios de aceitação:
		+ A opção para consultar o status da matrícula está disponível na página do aluno.
		+ O sistema exibe as informações atualizadas sobre o status da matrícula.

RF-005: Receber confirmação de pagamento por API e confirmar matrícula com rastreabilidade.
	* Critérios de aceitação:
		+ O sistema recebe a confirmação de pagamento via API.
		+ A matrícula é confirmada com rastreabilidade, incluindo data, hora e quem realizou a confirmação.

RF-006: Garantir integridade: uma pessoa não deve ter duas matrículas ativas na mesma turma.
	* Critérios de aceitação:
		+ O sistema verifica se o aluno já tem matrícula ativa na turma antes de permitir a solicitação de nova matrícula.

RF-007: Auditoria mínima: registrar quem pediu matrícula, quando e quando o pagamento foi confirmado.
	* Critérios de aceitação:
		+ O sistema registra todas as ações realizadas (solicitação de matrícula, confirmação do pagamento).
		+ As informações são armazenadas com rastreabilidade para auditoria futura.

#### Regras de Negócio

RB-001: A confirmação de pagamento deve ser idempotente.
RB-002: A matrícula deve ter estados claros (solicitada, aguardando pagamento, paga e confirmada, cancelada, expirada).

### non_functional.md

#### Segurança
- Autenticação e autorização feitas através do Certificare.

#### Privacidade
- Respeitamos a LGPD e armazenamos apenas os dados pessoais necessários.
- O acesso às informações é restrito aos usuários com permissão adequada.

#### Confiabilidade
- Garantimos disponibilidade de pelo menos 99,9% do tempo.
- Implementamos medidas de tolerância a falhas para garantir que o sistema permaneça operacional em caso de problemas.

#### Performance
- O sistema é otimizado para atender às necessidades de até 1.000 usuários simultâneos.
- Monitoramos constantemente a performance do sistema para ajustes e melhorias.

#### Auditoria
- Registrando todas as ações realizadas no sistema, incluindo solicitação de matrícula e confirmação de pagamento.
- As informações são armazenadas com rastreabilidade para auditoria futura.

#### Observabilidade
- Implementamos logs detalhados para monitoramento da atividade do sistema.
- Monitoramos constantemente a performance do sistema para ajustes e melhorias.

### glossary.md

| Termo | Definição | Exemplo |
|------|-----------|--------|
| Matrícula | Processo de inscrição em uma turma. | “Matrícula feita com sucesso.” |
| Confirmação de Pagamento | Verificação do pagamento efetuado para confirmar a matrícula. | “Pagamento verificado com sucesso.” |

### assumptions.md

AS-001: O Certificare é o sistema responsável pela autenticação e cadastro dos usuários.
AS-002: A API de confirmação de pagamento será implementada de forma idempotente.

### handoff_to_corrinha.md

#### Entradas
Os documentos gerados, incluindo requirements_md, non_functional_md, glossary_md e assumptions_md.

#### Próximo Passo
Corrinha deve criar os user stories e use cases com contratos de API para implementação do Schola.

#### Pontos Críticos
- A integridade do sistema deve ser garantida, evitando duplicação de matrículas.
- A auditoria das ações realizadas no sistema é fundamental para respeitar as leis de privacidade e segurança.
