# UC-16 — Emitir Credencial para Aluno (Admin)

**Ator principal:** Administrador  
**Endpoint:** `POST /admin/classes/:classId/enrollments/:profileId/credential`

## Pré-condições
- Aluno inscrito e ativo na turma
- Turma tem `badgeCode` configurado via curso
- Credencial ainda não emitida para o aluno neste período

## Fluxo Principal
1. Admin clica no ícone de troféu (🏆) na linha do aluno
2. **Popup de confirmação** exibe: badge code e nome do aluno
3. Admin clica "Emitir credencial"
4. Sistema busca turma com `course.badge` carregado (eager)
5. Sistema monta:
   - `certId = 100712733_{profileId}_{badge.code}_{year}_{month}`
   - `certUrl = {CERT_URL}/public/credentials/{certId}`
6. Sistema salva credencial com `isPublic=false`
7. Frontend atualiza linha do aluno com chip verde + link da credencial

## Fluxos Alternativos
- **Credencial já emitida (mesmo certId):** retorna existente sem duplicar
- **Badge não configurado:** `404: "Turma sem badge associado"`

## Pós-condições
- Credencial em `credentials` com `organizationId=100712733`, `organizationName="Produto Reativo"`
- `isPublic=false` por padrão (aluno controla visibilidade)
- Aluno pode tornar pública em `/credentials`
