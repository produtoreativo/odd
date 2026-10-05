# UC-17 — Compartilhar Pasta Google Drive com Aluno (Admin)

**Ator principal:** Administrador  
**Endpoint:** `POST /admin/classes/:classId/enrollments/:profileId/share-drive`

## Pré-condições
- Aluno inscrito e ativo na turma
- Curso tem `driveFolderId` configurado
- Aluno possui email Google válido (conta Google ativa)

## Fluxo Principal
1. Admin clica no ícone de pasta (📁) na linha do aluno (ícone cinza = não compartilhado)
2. **Popup de confirmação** exibe: nome, email Drive e aviso sobre notificação Google automática
3. Admin clica "Compartilhar"
4. Backend obtém `profile.googleEmail || profile.email`
5. Backend chama `Drive API permissions.list` para verificar permissões existentes
6. Se não compartilhado: `Drive API permissions.create` com `role='reader'`
7. Backend chama `markDriveShared(classId, profileId)` → `driveShared=true`, `driveSharedAt=now()`
8. Frontend exibe dialog de sucesso com link para abrir a pasta
9. Ícone na linha do aluno muda para **verde** com data em tooltip

## Fluxos Alternativos

### FA-01: Email sem conta Google
- Google API retorna: "cannot share with ... because they do not have a Google Account"
- Backend detecta o erro e retorna `{ ok: false, errorType: 'no_google_account', email }`
- Frontend exibe dialog de erro com instrução: "O aluno precisa atualizar o campo Email Google no perfil"

### FA-02: Pasta já compartilhada
- `permissions.list` encontra permissão existente
- Backend não duplica, retorna sucesso
- `driveShared` é atualizado normalmente

### FA-03: Curso sem driveFolderId
- Backend retorna `{ ok: false, errorType: 'no_folder' }`

## Pós-condições
- Aluno recebe email de convite do Google para acesso à pasta
- `driveShared=true` e `driveSharedAt` registrados em `class_enrollments`
- Ícone verde com data visível na tabela de inscritos
