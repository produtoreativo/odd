# VS-05 — Recuperação de Acesso

**Atores:** Aluno Autenticado, OneSignal (email)  
**Outcome principal:** Aluno recupera acesso à conta sem intervenção do Administrador.

---

## Fluxo

```
ALUNO                                               BACKEND           ONESIGNAL
─────                                               ───────           ─────────

[1] Acessa /auth/recovery
Informa email cadastrado
        │
        ▼
[2] POST /auth/recovery ──────────────────────► Busca perfil por email
                                                 Gera token (48 hex chars)
                                                 Define expiração: now() + 1h
                                                 Persiste resetPasswordCode
                                                          + resetPasswordExpiresAt
                                                     │
                                                     ▼
                                                Envia email ───────────────────► Email:
                                                                                 "Redefinir senha"
                                                                                 Link: /auth/password-reset/:token
        │
        ▼ (recebe email)
[3] Clica no link
/auth/password-reset/:token
        │
        ▼
[4] Informa nova senha
POST /auth/reset ─────────────────────────────► Busca perfil por token
                                                 Verifica: token não expirou
                                                 Gera novo hash bcrypt (1024 rounds)
                                                 Limpa resetPasswordCode
                                                 Limpa resetPasswordExpiresAt
                                                 Atualiza perfil
        │
        ▼
[5] Redireciona para /auth/login
```

---

## Steps detalhados

| # | Step | Endpoint | Validação |
|---|---|---|---|
| 1 | Acessa formulário de recuperação | `/auth/recovery` | — |
| 2 | Solicita reset por email | `POST /auth/recovery` | Email existe no banco |
| 3 | Recebe email com link de reset | OneSignal → email | — |
| 4 | Define nova senha com token | `POST /auth/reset` | Token existe + `resetPasswordExpiresAt > now()` |
| 5 | Faz login com nova senha | `POST /auth/login` | — |

---

## Fluxos alternativos

| Situação | Comportamento |
|---|---|
| Email não cadastrado | `401 Unauthorized: "Email não cadastrado"` |
| Token inválido/inexistente | `401 Unauthorized: "Token inválido"` |
| Token expirado (> 1 hora) | `401 Unauthorized: "Token expirado. Solicite nova recuperação."` |
| Rate limit (> 5 req/min) | `429 Too Many Requests` |

---

## Outcomes

- Aluno recupera acesso sem suporte manual
- Token de reset invalidado após uso ou expiração
- Senha atualizada com hash bcrypt (custo 12)
