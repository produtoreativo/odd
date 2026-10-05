# US-12 — Catálogo de Cursos

```gherkin
Feature: Catálogo de Cursos ProdOps

  As a visitante interessado em certificação
  I want to explorar o catálogo completo de cursos com todos os detalhes
  So that I can escolher o curso mais adequado ao meu perfil e objetivos profissionais

  Scenario: Visualização do catálogo completo
    Given que acesso /courses
    Then vejo grid com os 5 cursos disponíveis:
      | Curso                          | Nível        |
      | Observability Driven Design    | Intermediário |
      | ProdOps Foundation             | Fundação     |
      | ProdOps: Dirigindo AI          | Intermediário |
      | ProdOps Delivery               | Avançado     |
      | Engenheiro de Confiabilidade   | Formação     |

  Scenario: Detalhe de curso com turmas abertas
    Given que acesso /courses/prodops-foundation
    Then vejo a descrição completa do curso
    And vejo o público-alvo (PM, Tech Lead, Agile Coach, etc.)
    And vejo os outcomes de aprendizagem
    And vejo os módulos de conteúdo (públicos com YouTube, privados com cadeado)
    And vejo a seção "Turmas abertas para inscrição" com turmas disponíveis

  Scenario: Inscrição em turma — visitante não logado
    Given que não estou autenticado
    And visualizo uma turma aberta em /courses/odd
    When vejo a seção de inscrição
    Then vejo os botões "Entrar" e "Criar conta"
    And vejo o alerta: "Faça login ou crie sua conta para se inscrever"

  Scenario: Inscrição em turma — aluno logado
    Given que estou autenticado
    And visualizo a turma "Online" em /courses/odd
    When clico em "Inscrever-se"
    Then vejo popup de confirmação com nome da turma
    When confirmo a inscrição
    Then o chip muda para "Inscrito ✓"
    And recebo confirmação de inscrição

  Scenario: Visualização do QR Code PIX
    Given que visualizo as opções de pagamento de um curso
    When clico no ícone de QR Code ao lado da chave PIX
    Then vejo um dialog com a imagem do QR Code
    And vejo a chave PIX 39.835.268/0001-89
    And posso apontar a câmera para pagar
```
