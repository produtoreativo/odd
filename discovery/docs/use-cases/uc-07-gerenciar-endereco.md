# UC-07 — Gerenciar Endereço

**Ator principal:** Aluno Autenticado  
**Endpoint:** `PUT /profiles/address`

## Pré-condições
- Usuário autenticado acessa `/profile`

## Fluxo Principal
1. Sistema carrega endereço existente via `GET /profiles/address` (retorna `null` se inexistente)
2. Usuário preenche CEP no primeiro campo
3. Frontend detecta 8 dígitos completos e consulta ViaCEP: `GET https://viacep.com.br/ws/{cep}/json/`
4. Frontend auto-preenche: logradouro, bairro, cidade, estado, país
5. Usuário completa: número, complemento (opcionais)
6. Usuário submete
7. Sistema normaliza CEP para formato `XXXXX-XXX`
8. Sistema faz upsert (cria ou atualiza pelo `profileId`)
9. Sistema registra `profile.address.upserted`

## Fluxos Alternativos

### FA-01: CEP não encontrado no ViaCEP
- Frontend exibe "CEP não encontrado" (campos permanecem habilitados para preenchimento manual)

## Pós-condições
- Endereço salvo/atualizado em `addresses` com FK para `profiles` (CASCADE DELETE)

## Campos
```
cep, logradouro, numero?, complemento?, bairro, cidade, estado (2 chars), pais (default: 'Brasil')
```
