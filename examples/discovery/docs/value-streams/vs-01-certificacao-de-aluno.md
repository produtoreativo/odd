# VS-01 — Certificação de Aluno

**Atores:** Visitante Anônimo → Aluno Autenticado → Administrador → OneSignal → Google Drive API

**Outcome principal:** O aluno recebe uma credencial digital verificável, pública e compartilhável no LinkedIn.

---

## Fluxo

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                          VALUE STREAM: CERTIFICAÇÃO DE ALUNO                            │
└─────────────────────────────────────────────────────────────────────────────────────────┘

  VISITANTE               ALUNO                    ADMINISTRADOR           SISTEMAS
  ─────────               ─────                    ─────────────           ────────

  [1] Descobre            
  cursos na home          
  ou catálogo             
       │                  
       ▼                  
  [2] Visualiza           
  detalhes do curso       
  e opções de pagamento   
       │                  
       ▼                  
  [3] Cria conta ──────► [Perfil criado]                              ◄── OneSignal
  /auth/signup             │                                               (email de
                           ▼                                               boas-vindas)
                      [4] Define senha
                      /auth/password-reset/:token
                           │
                           ▼
                      [5] Faz login
                      /auth/login (JWT)
                           │
                           ▼
                      [6] Aguarda                ◄── [7] Admin inscreve
                      contato/pagamento              /admin/classes/:id/enrollments
                           │                              │
                           │                         [8] Admin compartilha Drive
                           │                         /share-drive
                           │                              │        ◄── Google Drive API
                           ▼                              ▼
                      [Acessa materiais]          [9] Admin emite credencial
                           │                      /enrollments/:id/credential
                           ▼                              │
                      [10] Recebe               ◄─────────┘
                      credencial isPublic=false
                           │
                           ▼
                      [11] Torna pública
                      PATCH /credentials/:certId/privacy
                           │
                           ▼
                      [12] Compartilha ──────────────────────────────────► LinkedIn
                      no LinkedIn
```

---

## Steps detalhados

| # | Step | Ator | Endpoint | Resultado |
|---|---|---|---|---|
| 1 | Descobre cursos na home ou catálogo | Visitante | `GET /` ou `GET /courses` | Interesse gerado |
| 2 | Visualiza detalhes do curso e opções de pagamento (PIX) | Visitante | `GET /courses/:id` | Intenção de compra |
| 3 | Cria conta (nome + email) | Visitante | `POST /auth/signup` | Perfil criado, email enviado |
| 4 | Define senha via link do email | Visitante→Aluno | `POST /auth/reset` | Senha definida |
| 5 | Faz login e recebe JWT | Aluno | `POST /auth/login` | Autenticado |
| 6 | Aguarda confirmação do pagamento | Aluno | — | — |
| 7 | Admin inscreve o aluno na turma por email | Administrador | `POST /admin/classes/:id/enrollments` | Inscrição `active` |
| 8 | Admin compartilha pasta Drive com materiais | Administrador | `POST /admin/classes/:classId/enrollments/:profileId/share-drive` | Aluno recebe convite Google |
| 9 | Admin emite credencial digital para o aluno aprovado | Administrador | `POST /admin/classes/:classId/enrollments/:profileId/credential` | Credencial criada |
| 10 | Aluno visualiza credencial em /credentials | Aluno | `GET /credentials` | Credencial visível |
| 11 | Aluno torna a credencial pública | Aluno | `PATCH /credentials/:certId/privacy` | `isPublic=true` |
| 12 | Aluno compartilha no LinkedIn | Aluno | Redirect LinkedIn | Post publicado |

---

## Outcomes

- Credencial digital com `certId` único, badge visual e URL pública verificável
- Credencial acessível em `/public/credentials/:certId` por qualquer pessoa
- Aluno pode validar a certificação no LinkedIn
- Credencial aparece na galeria `/certified`
- Rastreabilidade completa: inscrição → Drive compartilhado → credencial emitida

## Métricas de sucesso

- Taxa de conversão: visitante → aluno cadastrado
- Taxa de conclusão: inscrição → credencial emitida
- Taxa de compartilhamento: credencial emitida → tornada pública
