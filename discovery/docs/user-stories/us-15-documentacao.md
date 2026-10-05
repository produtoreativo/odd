# US-15 — Documentação do Framework ProdOps

```gherkin
Feature: Documentação do Framework ProdOps

  As a profissional ou visitante
  I want to ler a documentação das jornadas do Framework ProdOps
  So that I can entender os conceitos antes de me inscrever num curso

  Scenario: Acesso à documentação index
    Given que acesso /docs
    Then vejo o título "Documentação ProdOps"
    And vejo o diagrama ProdOpsDiagram
    And vejo a lista de jornadas disponíveis

  Scenario: Leitura de jornada específica
    Given que acesso /docs/:journeyId com um ID válido
    Then vejo o conteúdo da jornada com: detalhes, entradas, saídas e jornadas relacionadas

  Scenario: Jornada não encontrada
    Given que acesso /docs/jornada-inexistente
    Then vejo a mensagem "Jornada não encontrada"
```
