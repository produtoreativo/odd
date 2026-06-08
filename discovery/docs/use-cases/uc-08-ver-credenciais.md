# UC-08 — Visualizar Minhas Credenciais

**Ator principal:** Aluno Autenticado  
**Endpoint:** `GET /credentials`

## Fluxo Principal
1. Usuário acessa `/credentials`
2. Sistema retorna todas as credenciais do `profileId` do JWT
3. Frontend exibe grid com: badge, nome da certificação, data de emissão, organização emissora e status de privacidade

## Fluxos Alternativos
- **Sem credenciais:** estado vazio com botão "Ver Cursos"

## Pós-condições — nenhuma
