# UC-13 — Gerenciar Turmas (Admin)

**Ator principal:** Administrador  
**Endpoints:** `GET /admin/courses/:courseId/classes`, `POST /admin/courses/:courseId/classes`, `PATCH /admin/classes/:id`

## Pré-condições
- Curso existe no sistema

## Fluxo Principal — Criar Turma
1. Admin acessa `/admin/courses/:id`
2. Visualiza lista de turmas com: título, datas, inscritos (chip), vagas, flags (online/default), status
3. Admin clica em `+` → dialog de criação
4. Admin preenche: título*, startDate, endDate, isOnline, isDefault (apenas se online), capacidade, notas
5. Sistema chama `POST /admin/courses/:courseId/classes`

## Regras de negócio
- `isDefault=true` indica a turma padrão para inscrições online na página pública do curso
- `isActive=false` com data passada: cancelamento de inscrição bloqueado no frontend
- Turmas históricas importadas via migration têm `isActive=false` e notas com fonte original

## Pós-condições
- Turma salva em `course_classes`
- Contagem de inscritos calculada via agregação (`enrollmentCount` no response)
