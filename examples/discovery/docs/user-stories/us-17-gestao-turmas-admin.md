# US-17 — Gestão de Turmas (Admin)

```gherkin
Feature: Gestão de Turmas por Curso

  As a administrador
  I want to criar e gerenciar turmas dentro de cada curso
  So that I can organizar o calendário de certificações e controlar inscrições por turma

  Background:
    Given que estou autenticado como admin
    And acesso /admin/courses/:id

  Scenario: Visualização de turmas com contador de inscritos
    Then vejo tabela de turmas com:
      | Coluna    | Descrição                              |
      | Nome      | título da turma                        |
      | Início    | data formatada em pt-BR               |
      | Fim       | data formatada em pt-BR               |
      | Inscritos | chip colorido com total de ativos     |
      | Vagas     | capacidade ou ∞                       |
      | Flags     | ícones de Online (wifi) e Default (★) |
      | Status    | Ativa / Inativa                       |
      | Ações     | ver inscritos + editar                |

  Scenario: Criar turma online default
    When clico em + para nova turma
    And preencho título "Online" e marco "Online"
    And marco "Default (online)" que fica habilitado por ser online
    And clico em Salvar
    Then a turma aparece no topo da lista (isDefault ordenado primeiro)
    And aparece na seção de inscrição da página pública do curso

  Scenario: Criar turma histórica
    When crio uma turma com datas passadas e isActive=false
    Then a turma aparece na lista com status "Inativa"
    And o botão de cancelar inscrição não aparece para alunos dessa turma
```
