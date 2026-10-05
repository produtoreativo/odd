# VS-03 — Descoberta e Engajamento com o Framework ProdOps

**Atores:** Visitante Anônimo, Aluno Autenticado  
**Outcome principal:** Visitante compreende o posicionamento da ProdOps University e converte para aluno.

---

## Fluxo

```
VISITANTE
─────────

[1] Acessa home /
├── Hero: trilha Foundation → AI-Driven → Delivery → PRE
├── Seção de benefícios (ShadowBox, certificações verificáveis)
├── Cursos em destaque (Foundation, Dirigindo AI, PRE)
├── Badges disponíveis (PDPT01, PDAS01, PDPD01, PDRE02)
├── Seção About: sobre a ProdOps University
└── Seção Contato: Discord, Email, LinkedIn, Site
        │
        ▼
[2] Explora catálogo /courses
├── Grid de 5 cursos
└── Clica → /courses/:courseId
        │  ├── Descrição longa + público-alvo
        │  ├── Módulos (públicos/privados)
        │  ├── Próximas turmas abertas
        │  ├── Opções de pagamento + QR Code PIX
        │  └── Seção de inscrição (turmas abertas com botão Inscrever-se)
        │
        ▼
[3] Explora badges /badges → /badges/:code
├── Tagline e competências certificadas
├── Público-alvo por papel (PM, Tech Lead, Agile Coach, etc.)
├── Conteúdo programático (módulos e tópicos)
├── Formato, agenda, próxima turma
└── Preço, chave PIX e instrutor
        │
        ▼
[4] Lê documentação /docs → /docs/:journeyId
├── Diagrama ProdOps
└── Jornadas: Assessment, Delivery, Operation
        │
        ▼
[5] Converte
├── Clica em "Criar conta" → VS-01 (Certificação de Aluno)
└── Clica em "Inscrever-se" em turma online → Redireciona para login/cadastro
```

---

## Steps detalhados

| # | Ponto de contato | URL | Conteúdo chave |
|---|---|---|---|
| 1 | Home | `/` | Hero com trilha, benefícios, stats (500+ certificados), cursos em destaque, Discord |
| 2 | Catálogo | `/courses` | Grid de 5 cursos (ODD, Foundation, Dirigindo AI, Delivery, PRE) |
| 3 | Detalhe de curso | `/courses/:courseId` | Descrição completa, conteúdo, turmas abertas + PIX |
| 4 | Lista de badges | `/badges` | Todos os badges do banco de dados |
| 5 | Detalhe de badge | `/badges/:code` | Competências, programação, preço |
| 6 | Documentação | `/docs` | Jornadas do Framework ProdOps |
| 7 | Galeria | `/certified` | Profissionais certificados (paginada, 20/página) |

---

## Outcomes

- Visitante compreende a trilha de certificação ProdOps (4 níveis)
- Visitante identifica o curso adequado ao seu perfil
- Visitante inicia processo de inscrição (via PIX + cadastro)
- Aluno logado pode se inscrever diretamente em turmas online pela página do curso

## Pontos de conversão

- Botão "Começar agora" na home → `/courses`
- Botão "Inscrever-se" no detalhe do curso → autenticação + inscrição em turma
- Link Discord → https://discord.gg/XR9FCHXDGW
- Email → academy@produtoreativo.com.br
