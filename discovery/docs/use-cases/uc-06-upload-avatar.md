# UC-06 — Fazer Upload de Foto de Perfil

**Ator principal:** Aluno Autenticado  
**Endpoint:** `POST /profiles/photo`

## Pré-condições
- Usuário autenticado
- Arquivo é imagem (jpeg, png, webp, gif) com máximo 5 MB

## Fluxo Principal
1. Usuário clica em "Alterar foto" no perfil
2. Usuário seleciona arquivo no file picker (aceita: `image/jpeg,image/png,image/webp,image/gif`)
3. Frontend envia `POST /profiles/photo` com `multipart/form-data`
4. Multer valida MIME type declarado pelo cliente
5. Sistema detecta tipo real via **magic bytes** (`file-type` library) — ignora MIME declarado
6. Sistema gera `key = profiles/{uuid}.{ext}`
7. Sistema faz upload do buffer para S3 (`PutObjectCommand`)
8. Sistema monta URL pública `https://{bucket}.s3.{region}.amazonaws.com/{key}`
9. Sistema chama `updateAvatar(profileId, avatarUrl)`
10. Sistema retorna `{ avatarUrl }`
11. Redux despacha `PROFILE_AVATAR_UPLOAD_SUCCESS` e recarrega perfil

## Fluxos Alternativos

### FA-01: Arquivo > 5 MB
- Multer rejeita: `400 Bad Request`

### FA-02: MIME inválido (declarado)
- `400: "Apenas imagens (jpeg, png, webp, gif) são permitidas"`

### FA-03: Magic bytes inconsistentes com MIME declarado
- `400: "Conteúdo do arquivo não é uma imagem válida"`

## Pós-condições
- Foto armazenada no S3 em `profiles/` com UUID
- `avatarUrl` atualizado no perfil do banco de dados
- Imagem pública acessível imediatamente

## Segurança
- Validação dupla: MIME type + magic bytes (previne upload de executáveis)
- Filename gerado por UUID (não usa nome original do arquivo)
