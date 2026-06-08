# US-20 — Compartilhamento Google Drive (Admin)

```gherkin
Feature: Compartilhamento de Pasta Google Drive com Alunos

  As a administrador
  I want to compartilhar a pasta de materiais do curso com alunos inscritos
  So that I can dar acesso aos materiais de aula de forma controlada e rastreável

  Background:
    Given que estou autenticado como admin
    And o curso tem driveFolderId configurado
    And visualizo a lista de inscritos da turma

  Scenario: Compartilhamento bem-sucedido com email Google válido
    Given que o aluno tem googleEmail "aluno@gmail.com" (conta Google válida)
    And o ícone de pasta na linha do aluno está cinza (não compartilhado)
    When clico no ícone de pasta
    Then vejo popup: "Compartilhar a pasta do Google Drive com aluno@gmail.com? O Google enviará automaticamente um email de convite."
    When confirmo
    Then o Google envia email de convite para "aluno@gmail.com"
    And o ícone de pasta muda para verde
    And ao passar o mouse vejo o tooltip com a data do compartilhamento
    And vejo dialog de sucesso com botão "Abrir pasta no Drive"

  Scenario: Email sem conta Google
    Given que o aluno tem email "aluno@accenture.com" sem conta Google
    When confirmo o compartilhamento
    Then vejo dialog de erro: "O email 'aluno@accenture.com' não possui conta Google."
    And vejo alerta: "O aluno precisa atualizar o campo Email Google (Drive / Meet) no perfil"
    And vejo o email que foi tentado: "Email usado: aluno@accenture.com"

  Scenario: Pasta já compartilhada — sem duplicata
    Given que o Drive já tem permissão para "aluno@gmail.com"
    When compartilho novamente
    Then o sistema detecta permissão existente via Drive API
    And retorna sucesso sem criar permissão duplicada
    And registra driveSharedAt com a data atual

  Scenario: Curso sem pasta Drive configurada
    Given que o curso não tem driveFolderId
    Then o ícone de pasta NÃO aparece na coluna de ações
```
