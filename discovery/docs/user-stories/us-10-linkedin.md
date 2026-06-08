# US-10 — Compartilhamento no LinkedIn

```gherkin
Feature: Compartilhamento de Credencial no LinkedIn

  As a aluno autenticado com credencial emitida
  I want to compartilhar minha certificação diretamente no LinkedIn
  So that I can validar minha expertise profissional para recrutadores e colegas

  Scenario: Compartilhamento via botão
    Given que estou visualizando minha credencial em /public/credentials/:certId
    When clico no botão "Compartilhar no LinkedIn"
    Then sou redirecionado para o LinkedIn
    And a URL da minha credencial está pré-preenchida para publicação
    And o LinkedIn mostra uma prévia da credencial antes de publicar
```
