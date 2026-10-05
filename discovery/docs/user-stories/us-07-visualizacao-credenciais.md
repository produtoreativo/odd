# US-07 — Visualização de Credenciais

```gherkin
Feature: Visualização de Credenciais do Aluno

  As a aluno autenticado
  I want to visualizar todas as minhas credenciais digitais em um único lugar
  So that I can acompanhar meu histórico de certificações e compartilhá-las

  Scenario: Aluno com credenciais emitidas
    Given que tenho credenciais emitidas pelo administrador
    When acesso /credentials
    Then vejo um grid com cards de cada credencial
    And cada card mostra: imagem do badge, nome da certificação, data de emissão e organização
    And vejo o status de privacidade (Público / Privado) em cada credencial

  Scenario: Aluno sem credenciais
    Given que não tenho nenhuma credencial emitida
    When acesso /credentials
    Then vejo o estado vazio com a mensagem "Nenhuma credencial encontrada"
    And vejo um botão "Ver cursos disponíveis" que me leva para /courses
```
