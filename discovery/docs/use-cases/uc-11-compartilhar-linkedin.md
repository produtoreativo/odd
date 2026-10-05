# UC-11 — Compartilhar Credencial no LinkedIn

**Ator principal:** Aluno Autenticado  
**Endpoint:** Redirect externo LinkedIn

## Pré-condições
- Usuário visualiza credencial em `/public/credentials/:certId`

## Fluxo Principal
1. Usuário clica em "Compartilhar no LinkedIn"
2. Frontend redireciona para URL de compartilhamento LinkedIn com URL da credencial pré-preenchida
3. LinkedIn abre janela de publicação

## Pós-condições
- Post publicado no LinkedIn com link verificável da credencial
