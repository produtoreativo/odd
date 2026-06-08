# US-08 — Privacidade de Credencial

```gherkin
Feature: Controle de Privacidade de Credencial

  As a aluno autenticado com credenciais
  I want to controlar quais certificações aparecem publicamente
  So that I can decidir quando e como divulgar meu histórico de certificação

  Scenario: Tornar credencial pública
    Given que tenho uma credencial com status "Privado"
    When clico no chip "Privado" na credencial
    Then o chip muda para "Público"
    And a credencial passa a aparecer na galeria /certified
    And qualquer pessoa pode acessar /public/credentials/:certId

  Scenario: Tornar credencial privada novamente
    Given que tenho uma credencial com status "Público"
    When clico no chip "Público" na credencial
    Then o chip muda para "Privado"
    And a credencial é removida da galeria /certified
    And o link /public/credentials/:certId retorna 403
```
