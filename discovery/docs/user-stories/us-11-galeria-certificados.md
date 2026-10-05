# US-11 — Galeria de Certificados Públicos

```gherkin
Feature: Galeria de Certificados Públicos

  As a visitante anônimo
  I want to navegar pela galeria de profissionais certificados pela ProdOps University
  So that I can conhecer a comunidade e validar a relevância das certificações no mercado

  Scenario: Visualização da galeria com credenciais públicas
    Given que existem credenciais públicas no sistema
    When acesso /certified
    Then vejo o título "Pessoas Certificadas" e o subtítulo
    And vejo o total de certificações publicadas
    And vejo cards organizados em grid (3 por linha no desktop)
    And cada card mostra: badge (160x160), nome do badge, código, foto do profissional, nome, data e ícone LinkedIn se aplicável

  Scenario: Paginação da galeria
    Given que existem mais de 20 credenciais públicas
    When a galeria carrega
    Then vejo no máximo 20 credenciais por página
    And vejo o componente de paginação na parte inferior
    When clico na página 2
    Then vejo as próximas 20 credenciais
    And a página rola automaticamente para o topo

  Scenario: Galeria vazia
    Given que nenhuma credencial foi tornada pública
    When acesso /certified
    Then vejo o estado vazio com ícone de escola
    And vejo a mensagem "Nenhuma certificação pública ainda"
```
