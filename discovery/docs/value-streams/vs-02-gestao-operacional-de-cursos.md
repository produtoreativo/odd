# VS-02 — Gestão Operacional de Cursos (Admin)

**Atores:** Administrador, Google Drive API  
**Outcome principal:** Controle completo do ciclo de vida de cursos, turmas e inscrições com rastreabilidade total.

---

## Fluxo

```
ADMINISTRADOR                                            SISTEMAS
─────────────                                            ────────

[1] Acessa /admin
Visualiza lista de cursos
        │
        ▼
[2] Cria/edita curso ──────────────────────────────► POST /admin/courses
(título, URL, badgeCode,                             PATCH /admin/courses/:id
driveFolderId, descrição)
        │
        ▼
[3] Cria turmas ───────────────────────────────────► POST /admin/courses/:courseId/classes
(nome, datas, capacidade,
isOnline, isDefault)
        │
        ▼
[4] Visualiza lista de turmas ─────────────────────► GET /admin/courses/:id/classes
com contagem de inscritos                            (+ enrollmentCount agregado)
        │
        ▼
[5] Visualiza inscritos por turma ─────────────────► GET /admin/classes/:id/enrollments
(com status Drive e credencial)
        │
        ├──[6] Adiciona aluno por email ────────────► POST /admin/classes/:id/enrollments
        │       (com confirmação popup)
        │
        ├──[7] Compartilha pasta Drive ─────────────► POST /admin/classes/:classId/enrollments/:pid/share-drive
        │       (registra driveShared=true)               │
        │                                            ◄──► Google Drive API (permissions.create)
        │
        ├──[8] Emite credencial ────────────────────► POST /admin/classes/:classId/enrollments/:pid/credential
        │       (gera certId único)
        │
        └──[9] Cancela inscrição ───────────────────► DELETE /admin/classes/:classId/enrollments/:pid
                (só em turmas ativas/futuras)             (soft delete: status='cancelled')
```

---

## Steps detalhados

| # | Step | Precondição | Resultado |
|---|---|---|---|
| 1 | Acessa `/admin` e vê lista de cursos | `isAdmin=true` | Dashboard de cursos com badges |
| 2 | Cria ou edita curso | — | Curso em `admin_courses` |
| 3 | Cria turma para o curso | Curso existente | Turma em `course_classes` |
| 4 | Monitora inscritos por turma | Turma existente | Contagem em tempo real |
| 5 | Visualiza inscritos com status de Drive e credencial | Turma existente | Lista enriquecida |
| 6 | Adiciona aluno por email (popup de confirmação) | Perfil existente | `class_enrollments.status='active'` |
| 7 | Compartilha pasta Drive | `driveFolderId` configurado + email Google válido | `driveShared=true`, `driveSharedAt=now()` |
| 8 | Emite credencial | `badgeCode` configurado no curso | Credencial em `credentials` |
| 9 | Cancela inscrição (popup de confirmação) | Turma ativa ou futura | `status='cancelled'` |

---

## Outcomes

- Controle completo do ciclo de vida da turma no painel administrativo
- Registro de todas as credenciais emitidas por badge associado ao curso
- Rastreabilidade de compartilhamento de Drive (`driveShared`, `driveSharedAt`)
- Todos os botões transacionais protegidos com popup de confirmação
- Indicador visual: ícone verde quando Drive já foi compartilhado com data

## Regras de negócio

- Cancelamento de inscrição bloqueado para turmas inativas que já passaram
- Email usado no Drive é `googleEmail` do perfil, com fallback para `email` de cadastro
- `driveShared=true` é gravado somente após sucesso confirmado pela Google API
- Credencial gerada com `certId = 100712733_{profileId}_{badgeCode}_{year}_{month}` (idempotente)
