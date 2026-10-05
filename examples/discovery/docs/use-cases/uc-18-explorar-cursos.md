# UC-18 — Explorar Catálogo de Cursos

**Ator principal:** Visitante Anônimo  
**Dados:** Estáticos (courses.data.ts) — sem chamada ao backend

## Fluxo Principal
1. Visitante acessa `/courses`
2. Frontend exibe grid com 5 cursos: ODD, Foundation, Dirigindo AI, Delivery, PRE
3. Visitante clica em um curso → `/courses/:courseId`
4. Frontend exibe:
   - Nível, duração, formato, status
   - Descrição longa com formatação de listas
   - Público-alvo e outcomes de aprendizagem
   - **Seção de inscrição** (turmas abertas via `GET /courses/:courseId/open-classes`)
   - Conteúdo (módulos públicos com vídeo YouTube, módulos privados com ícone de cadeado)
   - Opções de pagamento + **botão QR Code PIX**
   - Próximas turmas abertas

## Seção de inscrição (turmas abertas)
- Busca turmas com `isActive=true` do curso identificado pelo URL slug
- Visitante não logado: vê botões "Entrar" e "Criar conta"
- Aluno logado: vê botão "Inscrever-se" por turma (com confirmação)
