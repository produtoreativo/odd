# US-13 — Trilha de Certificação

```gherkin
Feature: Trilha de Certificação ProdOps

  As a visitante interessado em crescimento profissional
  I want to visualizar a trilha completa de certificação ProdOps na home
  So that I can entender a progressão e planejar meu desenvolvimento

  Scenario: Visualização da trilha na home
    Given que acesso a home /
    When visualizo a seção "Trilha de Certificação"
    Then vejo os 4 passos em sequência:
      | Passo | Nome         | Badge  |
      | 1     | Fundação     | PDPT01 |
      | 2     | AI-Driven    | PDAS01 |
      | 3     | Delivery     | PDPD01 |
      | 4     | Reliability  | PDRE02 |
    And cada passo tem link para o curso correspondente
```
