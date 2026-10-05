# UC-22 — Emitir Credencial em Lote via API (Integração)

**Ator principal:** Administrador (via integração externa)  
**Endpoint:** `POST /credentials/credentials_with_profile`

## Pré-condições
- Usuário autenticado com JWT válido
- Badges existem no banco com os códigos informados

## Payload
```json
{
  "data": [
    {
      "profile": { "name": "Nome", "email": "email@ex.com", "linkedin": "..." },
      "credential": {
        "badge": { "code": "PDPT01" },
        "issueYear": "2024", "issueMonth": "11",
        "issuer": { "organizationId": "100712733", "organizationName": "Produto Reativo", "issuerName": "Christiano Milfont" }
      }
    }
  ]
}
```

## Fluxo Principal
1. Sistema itera sobre cada item do array `data`
2. Para cada item: `findOneOrCreate(email)` — cria perfil se não existir
3. Sistema busca badge pelo código
4. Sistema monta `CreateCredentialDto` com dados do badge + perfil
5. Sistema cria credencial via `create(dto)`
6. Sistema registra `credential.batch_issued` na observabilidade

## Pós-condições
- Múltiplas credenciais criadas em uma chamada
- Perfis inexistentes são criados automaticamente
- Observabilidade registra `credential.batch_issued` com contagem
