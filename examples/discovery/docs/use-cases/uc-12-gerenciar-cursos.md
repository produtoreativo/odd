# UC-12 — Gerenciar Cursos (Admin)

**Ator principal:** Administrador  
**Guard:** `AdminGuard` (verifica `isAdmin=true` no banco a cada request)  
**Endpoints:** `GET/POST /admin/courses`, `PATCH /admin/courses/:id`

## Pré-condições
- Usuário autenticado com `isAdmin=true`

## Fluxo Principal — Criar Curso
1. Admin acessa `/admin`, visualiza lista de cursos com badge icon, status e contadores
2. Admin clica em `+` → dialog de criação
3. Admin preenche: título*, URL, badgeCode (PDPT01/PDAS01/PDPD01/PDRE02/vazio), driveFolderId, descrição, isActive
4. Frontend envia apenas campos do DTO: `{ title, url?, badgeCode?, description?, isActive?, driveFolderId? }`
5. Sistema chama `POST /admin/courses`
6. Sistema salva em `admin_courses`

## Fluxo Alternativo — Editar Curso
1. Admin clica no ícone de edição na linha do curso
2. Dialog abre com dados pré-preenchidos
3. Admin edita e salva via `PATCH /admin/courses/:id`

## Pós-condições
- Curso disponível para criação de turmas
- Badge associado carregado via `eager: true` (relation com tabela `badges`)
- `driveFolderId` configurado permite compartilhamento de Drive em inscrições

## Campo crítico: driveFolderId
ID da pasta no Google Drive. Deve ser compartilhado com a service account `prodops-drive-bot@...` antes de usar.
