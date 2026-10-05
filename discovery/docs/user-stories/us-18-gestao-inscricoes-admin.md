# US-18 — Gestão de Inscrições em Turma (Admin)

```gherkin
Feature: Gestão de Inscrições por Turma

  As a administrador
  I want to inscrever, visualizar e cancelar alunos em turmas específicas
  So that I can controlar quem tem acesso ao material e é elegível para receber credencial

  Background:
    Given que estou autenticado como admin
    And acesso /admin/classes/:id

  Scenario: Visualização completa da lista de inscritos
    Then vejo tabela com colunas:
      | Coluna       | Descrição                                         |
      | Avatar       | foto de perfil do aluno                          |
      | Nome         | nome completo                                    |
      | Email/Drive  | email cadastro + email Drive (com indicador de cor) |
      | Inscrito em  | data formatada                                   |
      | Status       | Ativo / Cancelado                               |
      | Credencial   | chip verde com data se emitida, ou "Não emitida" |
      | Ações        | Drive, Troféu (se elegível), Cancelar (se ativo) |

  Scenario: Indicador de email Drive
    Given que um aluno tem googleEmail diferente do email de cadastro
    Then vejo o email de cadastro em cinza (linha superior)
    And vejo o googleEmail em verde com ícone 📁 (linha inferior — será usado no Drive)

  Scenario: Inscrever aluno por email com confirmação
    Given que digito "aluno@gmail.com" no campo de email
    When clico em "Inscrever"
    Then vejo popup: "Inscrever aluno@gmail.com na turma Foundation Junho 2026?"
    When confirmo
    Then o aluno aparece na tabela com status "Ativo"
    And o contador de inscritos da turma é atualizado

  Scenario: Cancelar inscrição com confirmação
    Given que o aluno está ativo e a turma é ativa
    When clico no ícone de remoção
    Then vejo popup: "Cancelar a inscrição de [Nome] na turma [Turma]?"
    When confirmo o cancelamento
    Then o aluno aparece como "Cancelado" na lista
    And o ícone de cancelar não aparece mais para esse aluno

  Scenario: Cancelamento bloqueado em turma encerrada
    Given que a turma é inativa e tem data passada
    Then o ícone de cancelar NÃO aparece para nenhum aluno da turma
```
