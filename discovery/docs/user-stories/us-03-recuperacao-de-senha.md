# US-03 — Recuperação de Senha

```gherkin
Feature: Recuperação de Senha

  As a aluno que esqueceu sua senha
  I want to solicitar recuperação de senha pelo meu email
  So that I can redefinir minha senha sem precisar de suporte humano

  Scenario: Solicitação de recuperação com email válido
    Given que tenho conta ativa com email "cmilfont@gmail.com"
    And acesso /auth/recovery
    When preencho "cmilfont@gmail.com" no campo Email
    And clico em "Enviar Email de Recuperação"
    Then vejo a mensagem "Email de recuperação enviado com sucesso!"
    And recebo um email com link /auth/password-reset/:token
    And o link é válido por 1 hora

  Scenario: Solicitação com email não cadastrado
    Given que acesso /auth/recovery
    When preencho "naoexiste@gmail.com" no campo Email
    And clico em enviar
    Then vejo a mensagem de erro "Email não cadastrado"

  Scenario: Redefinição com token válido
    Given que recebi um link de reset válido por email
    And acesso /auth/password-reset/:token
    When preencho minha nova senha
    And clico em "Atualizar"
    Then vejo a mensagem "Senha atualizada com sucesso!"
    And sou redirecionado para /auth/login
    And consigo fazer login com a nova senha

  Scenario: Tentativa com token expirado
    Given que o link de reset tem mais de 1 hora
    When acesso /auth/password-reset/:token
    And submeto o formulário de nova senha
    Then vejo o erro "Token expirado. Solicite uma nova recuperação de senha."
    And o link não funciona mais

  Scenario: Tentativa com token inválido
    Given que o token no link foi adulterado ou não existe
    When submeto o formulário de nova senha
    Then vejo o erro "Token inválido"
```
