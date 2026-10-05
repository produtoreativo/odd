# US-14 — Badges de Certificação

```gherkin
Feature: Exploração de Badges ProdOps

  As a profissional buscando certificação
  I want to entender cada badge disponível com suas competências e requisitos
  So that I can saber exatamente o que cada certificação valida no mercado

  Scenario: Visualização da lista de badges
    Given que acesso /badges
    Then vejo todos os badges cadastrados no banco de dados
    And cada card mostra: imagem do badge, nome e código (PDPT01, PDAS01, PDPD01, PDRE02)

  Scenario: Detalhe de badge — ProdOps Foundation
    Given que clico no badge PDPT01
    And acesso /badges/PDPT01
    Then vejo:
      | Seção              | Conteúdo                                       |
      | Tagline            | "ProdOps 1 — Capacite-se para estruturar..."  |
      | Competências       | lista de 9 competências certificadas           |
      | Público-alvo       | PM, Agile Coach, Tech Lead, Dev/Tester         |
      | Conteúdo           | 3 partes com tópicos detalhados                |
      | Formato            | Online via Zoom — ShadowBox                   |
      | Próxima turma      | data da próxima turma                          |
      | Investimento       | preço e chave PIX                              |
      | Instrutor          | Christiano Milfont                             |
```
