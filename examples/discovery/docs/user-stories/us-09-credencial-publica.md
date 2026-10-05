# US-09 — Credencial Pública Verificável

```gherkin
Feature: Verificação de Credencial Pública

  As a visitante anônimo
  I want to verificar a autenticidade de uma credencial pelo certId
  So that I can validar se uma certificação ProdOps é legítima

  Scenario: Acesso a credencial pública válida
    Given que uma credencial pública existe com certId "100712733_1_PDPT01_2024_11"
    When acesso /public/credentials/100712733_1_PDPT01_2024_11
    Then vejo o certificado visual com:
      | Campo          | Valor                          |
      | Badge          | imagem do PDPT01               |
      | Nome           | nome do profissional           |
      | Organização    | Produto Reativo                |
      | Emissão        | mês/ano de emissão             |
      | Expiração      | mês/ano de expiração           |

  Scenario: Credencial privada bloqueada
    Given que a credencial "100712733_1_PDPT01_2024_11" tem isPublic=false
    When acesso /public/credentials/100712733_1_PDPT01_2024_11
    Then vejo o erro 403

  Scenario: Credencial inexistente
    Given que o certId "invalido_123" não existe
    When acesso /public/credentials/invalido_123
    Then vejo o erro 404 Not Found
```
