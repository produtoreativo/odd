# VS-04 — Gestão do Perfil do Aluno

**Atores:** Aluno Autenticado, AWS S3  
**Outcome principal:** Perfil completo e atualizado, garantindo dados corretos nas credenciais e compatibilidade com o compartilhamento do Google Drive.

---

## Fluxo

```
ALUNO                                                   S3 / BACKEND
─────                                                   ────────────

[1] Acessa /profile
Carrega: perfil (GET /auth/profile)
         endereço (GET /profiles/address)
        │
        ├──[2] Atualiza dados pessoais ─────────────► PATCH /profiles/:id
        │  nome, telefone, LinkedIn,                  (ValidationPipe: name, phone,
        │  email Google (Drive/Meet)                   linkedin, googleEmail)
        │
        ├──[3] Faz upload de foto ─────────────────► POST /profiles/photo
        │  Seleção → magic bytes validation            │
        │  → S3 profiles/{uuid}.{ext}            ─────► S3 (público)
        │  → avatarUrl salvo no perfil                 │
        │                                          ◄───┘ URL retornada
        │
        └──[4] Gerencia endereço ──────────────────► PUT /profiles/address
           CEP → ViaCEP auto-fill                      (upsert por profileId)
           logradouro, número, complemento,
           bairro, cidade, estado, país
```

---

## Steps detalhados

| # | Step | Endpoint | Validação |
|---|---|---|---|
| 1 | Carrega dados do perfil e endereço | `GET /auth/profile` + `GET /profiles/address` | JWT válido |
| 2 | Atualiza dados pessoais | `PATCH /profiles/:id` | `req.user.id === id` (anti-IDOR) |
| 3 | Upload foto | `POST /profiles/photo` | Magic bytes + MIME type + 5 MB máx |
| 4 | Auto-fill CEP | ViaCEP (`https://viacep.com.br/ws/{cep}/json/`) | 8 dígitos |
| 5 | Salva endereço | `PUT /profiles/address` | Normaliza CEP para `XXXXX-XXX` |

---

## Campo crítico: Email Google

O campo `googleEmail` determina qual email será usado quando o Administrador compartilhar a pasta do Google Drive com o aluno.

```
profileEdit.googleEmail → PATCH /profiles/:id
        │
        ▼
class_enrollments.profile.googleEmail  (carregado via eager relation)
        │
        ▼
POST /share-drive → driveService.shareFolder(folderId, googleEmail || email)
```

**Regra:** Se `googleEmail` não estiver preenchido, usa-se o `email` de cadastro como fallback.

---

## Outcomes

- Foto de perfil exibida nas credenciais e na galeria `/certified`
- Email Google registrado permite compartilhamento correto do Drive
- Endereço disponível para processos de certificação físicos (se aplicável)
- Dados atualizados refletidos imediatamente nas credenciais já emitidas
</content>
</invoke>