# Documentação — ProdOps University

Documentação técnica e de produto da plataforma de certificação ProdOps University.

## Estrutura

```
docs/
├── README.md                     ← este arquivo
├── value-streams/                ← Value Streams mapeados
│   ├── README.md                 ← visão geral e atores
│   ├── vs-01-certificacao-de-aluno.md
│   ├── vs-02-gestao-operacional-de-cursos.md
│   ├── vs-03-descoberta-e-engajamento.md
│   ├── vs-04-gestao-do-perfil.md
│   └── vs-05-recuperacao-de-acesso.md
├── use-cases/                    ← Use Cases estilo UML
│   ├── README.md                 ← diagrama de atores e índice
│   ├── uc-01-criar-conta.md
│   ├── uc-02-fazer-login.md
│   ├── uc-03-recuperar-senha.md
│   ├── uc-04-redefinir-senha.md
│   ├── uc-05-atualizar-perfil.md
│   ├── uc-06-upload-avatar.md
│   ├── uc-07-gerenciar-endereco.md
│   ├── uc-08-ver-credenciais.md
│   ├── uc-09-controlar-privacidade.md
│   ├── uc-10-ver-credencial-publica.md
│   ├── uc-11-compartilhar-linkedin.md
│   ├── uc-12-gerenciar-cursos.md
│   ├── uc-13-gerenciar-turmas.md
│   ├── uc-14-gerenciar-inscricoes.md
│   ├── uc-15-cancelar-inscricao.md
│   ├── uc-16-emitir-credencial.md
│   ├── uc-17-compartilhar-drive.md
│   ├── uc-18-explorar-cursos.md
│   ├── uc-19-explorar-badges.md
│   ├── uc-20-galeria-certificados.md
│   ├── uc-21-documentacao.md
│   └── uc-22-emissao-em-lote.md
└── user-stories/                 ← User Stories BDD (Gherkin)
    ├── README.md                 ← índice geral
    ├── us-01-cadastro.md
    ├── us-02-autenticacao.md
    ├── us-03-recuperacao-de-senha.md
    ├── us-04-gestao-de-perfil.md
    ├── us-05-upload-de-foto.md
    ├── us-06-endereco.md
    ├── us-07-visualizacao-credenciais.md
    ├── us-08-privacidade-credencial.md
    ├── us-09-credencial-publica.md
    ├── us-10-linkedin.md
    ├── us-11-galeria-certificados.md
    ├── us-12-catalogo-de-cursos.md
    ├── us-13-trilha-certificacao.md
    ├── us-14-badges.md
    ├── us-15-documentacao.md
    ├── us-16-gestao-cursos-admin.md
    ├── us-17-gestao-turmas-admin.md
    ├── us-18-gestao-inscricoes-admin.md
    ├── us-19-emissao-credenciais-admin.md
    └── us-20-compartilhamento-drive-admin.md
```

## Atores do sistema

| Ator | Descrição |
|---|---|
| **Visitante Anônimo** | Sem autenticação — acessa catálogo, badges, galeria e docs |
| **Aluno Autenticado** | Cadastrado — gerencia perfil, credenciais e inscrições |
| **Administrador** | `isAdmin=true` — gerencia cursos, turmas, emite credenciais e compartilha Drive |
| **OneSignal** | Serviço de email transacional |
| **Google Drive API** | Compartilhamento de pastas via Service Account |
| **AWS S3** | Armazenamento de fotos de perfil |
| **LinkedIn** | Destino de compartilhamento de credenciais |

## Resumo dos números

| Artefato | Quantidade |
|---|---|
| Value Streams | 5 |
| Use Cases | 22 |
| User Stories | 20 |
| Cenários BDD | 52+ |
| Atores | 7 |
