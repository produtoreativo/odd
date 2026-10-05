# UC-15 — Cancelar Inscrição em Turma (Admin)

**Ator principal:** Administrador  
**Endpoint:** `DELETE /admin/classes/:classId/enrollments/:profileId`

## Pré-condições
- Inscrição existe com `status='active'`
- Turma está ativa **ou** ainda não iniciou (`startDate` no futuro)

## Fluxo Principal
1. Admin clica no ícone de remoção na linha do aluno
2. **Popup de confirmação** exibe: nome do aluno e nome da turma
3. Admin clica "Confirmar cancelamento"
4. Sistema atualiza `status='cancelled'` (soft delete, registro mantido)

## Restrição
- Botão de cancelamento **não aparece** para turmas `isActive=false` com data de início no passado

## Pós-condições
- Inscrição com `status='cancelled'`
- Aluno não aparece como ativo na contagem da turma
