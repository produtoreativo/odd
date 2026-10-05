# UC-14 — Gerenciar Inscrições em Turma (Admin)

**Ator principal:** Administrador  
**Endpoint:** `POST /admin/classes/:id/enrollments`

## Pré-condições
- Turma existe no sistema

## Fluxo Principal
1. Admin acessa `/admin/classes/:id`
2. Visualiza inscritos com: avatar, nome, email/email Drive, data, status, credencial, ícone Drive
3. Admin digita email do aluno no campo
4. Admin clica em "Inscrever" → **popup de confirmação** com email e nome da turma
5. Admin confirma
6. Sistema chama `POST /admin/classes/:id/enrollments` com `{ email }`
7. Sistema busca perfil pelo email (case-insensitive)
8. Sistema cria `class_enrollments` com `status='active'`

## Fluxos Alternativos
- **Aluno já ativo:** `409 Conflict: "Perfil já inscrito nesta turma"`
- **Email não encontrado:** `404 Not Found: "Perfil com email '...' não encontrado"`
- **Inscrição cancelada reativada:** `status='cancelled'` → `status='active'`

## Coluna "Email / Drive" na tabela
- Linha superior: email de cadastro (cinza)
- Linha inferior: email Drive (`googleEmail || email`)
  - **Verde**: `googleEmail` diferente do cadastro (configurado corretamente)
  - **Laranja**: usando email de cadastro como fallback
