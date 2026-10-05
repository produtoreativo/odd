# US-02 — Autenticação

```gherkin
Feature: Autenticação na Plataforma

  As a aluno com conta ativa
  I want to fazer login com meu email e senha
  So that I can acessar minhas credenciais, perfil e recursos exclusivos da plataforma

  Background:
    Given que tenho uma conta ativa na plataforma
    And acesso /auth/login

  Scenario: Login bem-sucedido
    Given que minha senha está configurada corretamente
    When preencho "cmilfont@gmail.com" no campo Email
    And preencho minha senha correta no campo Senha
    And clico em "Entrar"
    Then sou autenticado com sucesso
    And recebo um JWT com expiração de 24 horas
    And sou redirecionado para a home autenticada
    And meu avatar aparece no menu lateral

  Scenario: Credenciais inválidas — senha incorreta
    Given que tenho conta ativa
    When preencho meu email correto
    And preencho uma senha incorreta
    And clico em "Entrar"
    Then vejo mensagem de erro de credenciais inválidas
    And permaneço na página /auth/login

  Scenario: Logout
    Given que estou autenticado
    When clico no botão "Sair" no menu lateral
    Then meu JWT é invalidado no cliente
    And sou redirecionado para /auth/login
    And o campo de senha não aparece salvo no localStorage

  Scenario: Token expirado ao navegar
    Given que meu JWT expirou (mais de 24 horas)
    When tento acessar uma rota protegida como /credentials
    Then recebo 401 Unauthorized
    And sou redirecionado para /auth/login
```
