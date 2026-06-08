# US-16 — Gestão de Cursos (Admin)

```gherkin
Feature: Gestão Administrativa de Cursos

  As a administrador da ProdOps University
  I want to criar, editar e visualizar cursos com badges e pastas Drive associadas
  So that I can gerenciar toda a operação de certificações em um painel centralizado

  Background:
    Given que estou autenticado com isAdmin=true
    And acesso /admin

  Scenario: Visualização da lista de cursos
    Then vejo tabela com todos os cursos
    And cada linha mostra: ícone do badge associado, nome, status, badge code
    And vejo botões de ação: ver inscritos e editar

  Scenario: Criar novo curso com badge e Drive
    When clico no botão + (Fab)
    Then vejo o dialog de criação de curso
    When preencho:
      | Campo          | Valor                                              |
      | Nome           | ProdOps Foundation                                 |
      | URL            | /courses/prodops-foundation                        |
      | Badge Code     | PDPT01                                             |
      | Pasta Drive    | 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74               |
      | Descrição      | Os fundamentos do Framework ProdOps                |
    And clico em "Salvar"
    Then o curso aparece na lista com o ícone do badge PDPT01

  Scenario: Campos extras causam 400 (ValidationPipe)
    Given que o formulário envia apenas os campos do DTO
    Then o backend aceita: title, url, badgeCode, driveFolderId, description, isActive
    And campos extras como "id" ou "badge" são rejeitados com 400
```
