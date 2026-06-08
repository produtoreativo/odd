# US-01 — Cadastro na Plataforma

```gherkin
Feature: Cadastro na Plataforma

  As a visitante interessado em certificação ProdOps
  I want to criar uma conta informando meu nome e email
  So that I can ter acesso ao ecossistema de certificações e receber meu link de definição de senha

  Background:
    Given que acesso a URL https://prodops.university/auth/signup

  Scenario: Cadastro bem-sucedido com email novo
    Given que meu email não está cadastrado na plataforma
    When preencho "Christiano Milfont" no campo Nome
    And preencho "cmilfont@gmail.com" no campo Email
    And clico no botão "Criar conta"
    Then sou redirecionado para /auth/login
    And recebo um email com assunto "Defina sua senha na ProdOps University"
    And o email contém um link /auth/password-reset/:token válido por 1 hora

  Scenario: Tentativa de cadastro com email já cadastrado
    Given que o email "cmilfont@gmail.com" já está cadastrado
    When preencho "Christiano Milfont" no campo Nome
    And preencho "cmilfont@gmail.com" no campo Email
    And clico em "Criar conta"
    Then vejo a mensagem de erro "Email já cadastrado"
    And permaneço na página /auth/signup

  Scenario: Rate limit de cadastro excedido
    Given que já fiz 5 tentativas de cadastro no último minuto
    When tento criar uma nova conta
    Then recebo erro 429 Too Many Requests
```
