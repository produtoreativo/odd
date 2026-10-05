# US-19 — Emissão de Credenciais (Admin)

```gherkin
Feature: Emissão de Credenciais Digitais

  As a administrador
  I want to emitir credenciais digitais para alunos aprovados diretamente pelo painel
  So that I can certificar profissionais de forma rastreável e instantânea

  Background:
    Given que estou autenticado como admin
    And visualizo a lista de inscritos de uma turma com badgeCode configurado

  Scenario: Emissão bem-sucedida com confirmação
    Given que o aluno "Pablo Zaniolo" está inscrito e ativo
    And não possui credencial para o badge PDPT01 neste período
    When clico no ícone de troféu na linha do aluno
    Then vejo popup: "Emitir credencial PDPT01 para Pablo Zaniolo? Esta ação não pode ser desfeita pelo painel."
    When clico em "Emitir credencial"
    Then a coluna Credencial exibe chip verde com mês/ano
    And o chip é um link para /public/credentials/:certId
    And o ícone de troféu desaparece (credencial já emitida)

  Scenario: Prevenção de duplicata
    Given que a credencial foi emitida no mesmo período
    When tento emitir novamente
    Then o sistema retorna a credencial existente sem criar duplicata
    And a interface já mostra o chip verde (ícone de troféu não aparece)

  Scenario: Turma sem badge configurado
    Given que o curso não tem badgeCode
    Then o ícone de troféu não aparece para nenhum aluno
```
