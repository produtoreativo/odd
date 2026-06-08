# US-04 — Gestão de Perfil

```gherkin
Feature: Gestão de Perfil do Aluno

  As a aluno autenticado
  I want to atualizar meus dados pessoais e de contato no meu perfil
  So that minhas credenciais reflitam informações atualizadas e o admin possa me dar acesso aos materiais no Drive

  Background:
    Given que estou autenticado
    And acesso /profile

  Scenario: Atualização de nome e telefone
    Given que meus dados estão desatualizados
    When edito o campo Nome para "Christiano Milfont Atualizado"
    And edito o campo Telefone para "+55 11 99999-0000"
    And clico em "Atualizar"
    Then vejo a mensagem de sucesso
    And meu nome atualizado aparece nas credenciais

  Scenario: Atualização do email Google para compatibilidade com Drive
    Given que meu email de cadastro "cmilfont@accenture.com" não é uma conta Google
    And o campo "Email Google (Drive / Meet)" exibe "cmilfont@accenture.com" como valor default
    When preencho "cmilfont@gmail.com" no campo Email Google
    And clico em "Atualizar"
    Then meu googleEmail é salvo como "cmilfont@gmail.com"
    And o admin poderá compartilhar pastas do Drive com esse email

  Scenario: Tentativa de editar perfil de outro usuário
    Given que tento fazer PATCH /profiles/999 sendo o usuário de id 1
    Then recebo 403 Forbidden
    And meu perfil não é alterado
```
