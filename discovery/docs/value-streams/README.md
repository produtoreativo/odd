# Value Streams — ProdOps University

Value Streams mapeados na plataforma de certificação ProdOps University.  
Cada stream representa um fluxo de valor ponta a ponta percebido por um ou mais atores.

## Atores

| Ator | Descrição |
|---|---|
| **Visitante Anônimo** | Qualquer pessoa sem autenticação. Acessa home, cursos, badges, galeria pública e documentação |
| **Aluno Autenticado** | Profissional cadastrado. Gerencia perfil, credenciais e inscrições |
| **Administrador** | Usuário com `isAdmin=true`. Gerencia cursos, turmas, inscrições, emite credenciais e compartilha Drive |
| **OneSignal** | Sistema de email transacional para boas-vindas e recuperação de senha |
| **Google Drive API** | Compartilhamento de pastas de materiais via Service Account |
| **AWS S3** | Armazenamento de fotos de perfil (bucket `certificare-images`, público por padrão) |
| **LinkedIn** | Destino de compartilhamento de credenciais pelos alunos |

---

## Índice de Value Streams

1. [VS-01 — Certificação de Aluno](./vs-01-certificacao-de-aluno.md)
2. [VS-02 — Gestão Operacional de Cursos](./vs-02-gestao-operacional-de-cursos.md)
3. [VS-03 — Descoberta e Engajamento com o Framework](./vs-03-descoberta-e-engajamento.md)
4. [VS-04 — Gestão do Perfil do Aluno](./vs-04-gestao-do-perfil.md)
5. [VS-05 — Recuperação de Acesso](./vs-05-recuperacao-de-acesso.md)
