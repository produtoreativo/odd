# US-06 — Endereço no Perfil

```gherkin
Feature: Cadastro de Endereço no Perfil

  As a aluno autenticado
  I want to cadastrar meu endereço no perfil
  So that meus dados de localização fiquem disponíveis para processos de certificação

  Background:
    Given que estou autenticado e acesso /profile
    And visualizo a seção "Endereço" (opcional)

  Scenario: Auto-preenchimento por CEP via ViaCEP
    Given que o campo CEP está vazio
    When digito "01310-100" no campo CEP
    Then o sistema consulta https://viacep.com.br/ws/01310100/json/
    And o campo Logradouro é preenchido com "Avenida Paulista"
    And o campo Bairro é preenchido com "Bela Vista"
    And o campo Cidade é preenchido com "São Paulo"
    And o campo Estado é preenchido com "SP"
    And o campo País é preenchido com "Brasil"

  Scenario: CEP não encontrado
    Given que digito "00000-000" no campo CEP
    When o ViaCEP retorna erro
    Then vejo a mensagem "CEP não encontrado"
    And posso preencher os campos manualmente

  Scenario: Salvar endereço
    Given que preenchi todos os campos obrigatórios
    When clico em "Salvar Endereço"
    Then vejo o alerta verde "Endereço salvo!"
    And o endereço é persistido no banco associado ao meu perfil
```
