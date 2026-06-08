# US-05 — Upload de Foto de Perfil

```gherkin
Feature: Upload de Foto de Perfil

  As a aluno autenticado
  I want to fazer upload da minha foto de perfil
  So that minha foto apareça nas minhas credenciais e na galeria de certificados públicos

  Background:
    Given que estou autenticado e acesso /profile

  Scenario: Upload de imagem JPEG válida
    Given que tenho um arquivo "foto.jpg" de 2 MB
    When clico em "Alterar foto" e seleciono o arquivo
    Then vejo o spinner "Enviando..." enquanto o upload ocorre
    And minha nova foto aparece no perfil após o upload
    And a foto é armazenada em S3 com URL pública

  Scenario: Rejeição de arquivo com MIME inválido
    Given que tenho um arquivo "documento.pdf"
    When tento fazer upload
    Then vejo o erro "Apenas imagens (jpeg, png, webp, gif) são permitidas"
    And minha foto atual não é alterada

  Scenario: Rejeição de arquivo com tamanho excessivo
    Given que tenho um arquivo "foto_grande.jpg" de 10 MB
    When tento fazer upload
    Then o upload é rejeitado antes de chegar ao servidor
    And vejo mensagem de tamanho excedido

  Scenario: Detecção de arquivo disfarçado como imagem
    Given que tenho um executável renomeado como "foto.jpg"
    When tento fazer upload
    Then o sistema detecta os magic bytes incorretos
    And vejo o erro "Conteúdo do arquivo não é uma imagem válida"
```
