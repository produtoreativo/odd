# Intenção do produto: Schola
Atualizado em 2026-03-05 as 16:57

Schola é um produto para gerenciar novas turmas do curso de ProdOps.

Objetivo principal: permitir que uma pessoa veja turmas abertas, faça matrícula e tenha a matrícula confirmada após confirmação de pagamento.

O login e o cadastro de usuário não serão implementados no Schola. O Schola deve apontar e integrar com a aplicação Certificare já existente para autenticação e cadastro.

Depois de autenticado, o Schola lista turmas novas criadas para o curso de ProdOps, permite solicitar matrícula e acompanha o status.

O Schola expõe uma API para receber confirmação de pagamento e, com isso, confirmar a matrícula do aluno.

Escopo funcional mínimo:
- Redirecionar para login e cadastro usando Certificare e receber o retorno autenticado.
- Listar turmas do curso de ProdOps que estão abertas para matrícula.
- Permitir que um usuário autenticado solicite matrícula em uma turma.
- Permitir consultar status da matrícula.
- Receber confirmação de pagamento por API e confirmar matrícula com rastreabilidade.

Regras e restrições:
- Autenticação e cadastro são responsabilidade do Certificare.
- A confirmação de pagamento deve ser idempotente.
- A matrícula deve ter estados claros: solicitada, aguardando pagamento, paga e confirmada, cancelada, expirada.
- Garantir integridade: uma pessoa não deve ter duas matrículas ativas na mesma turma.
- Auditoria mínima: registrar quem pediu matrícula, quando, e quando o pagamento foi confirmado.

Saídas esperadas do processo dos agentes:
- Requisitos e critérios de aceite claros.
- User stories e use cases com contratos de API.
- Event storming com eventos de domínio e uma base inicial para ODD em planilha.