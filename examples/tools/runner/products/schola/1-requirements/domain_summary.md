**Domain Summary**

## Objetivo do produto

O objetivo do Schola é gerenciar novas turmas do curso de ProdOps, permitindo que uma pessoa veja turmas abertas, faça matrícula e tenha a matrícula confirmada após confirmação de pagamento.

## Atores

* Aluno
* Administração de ProdOps (Admin_ProdOps)
* Sistema de Pagamento

## Entidades principais

* Turma
* Matrícula
* Pagamento

## Integrações externas

* Autenticação e cadastro delegados para Certificare
* Recepção de confirmação de pagamento via webhook

## Eventos externos

* Confirmação de pagamento

## Fluxos principais

1. O aluno se autentica no Schola através da integração com o Certificare.
2. O aluno lista as turmas abertas para matrícula e solicita a matrícula em uma turma específica.
3. A Administração de ProdOps é notificada sobre a solicitação de matrícula.
4. O sistema de pagamento é notificado sobre a confirmação de pagamento.
5. A matrícula é confirmada após a confirmação de pagamento.

## Restrições

* Não duplicar cadastro local
* Confirmação de pagamento deve ser idempotente
* Toda confirmação deve ser auditável

## Dúvidas abertas

* Como o Schola lidará com matrículas canceladas ou expiradas?
* Quais são as implicações da integração com o Certificare?

## Regras de qualidade

O resumo reflete corretamente o domínio do produto, capturando os fluxos principais e restrições reais. As ambiguidades foram deixadas explícitas para a próxima etapa de requisitos.
