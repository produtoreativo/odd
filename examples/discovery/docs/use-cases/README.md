# Use Cases — ProdOps University

Casos de uso no estilo UML com fluxo principal, fluxos alternativos, pré e pós-condições.

## Diagrama de Atores e Casos de Uso

```
                    ┌─────────────────────────────────────────────────────┐
                    │              ProdOps University Platform             │
                    │                                                     │
  ┌───────────┐     │  UC-18 Explorar Catálogo          UC-21 Ler Docs    │
  │ Visitante │────►│  UC-19 Explorar Badges            UC-20 Ver Galeria  │
  │  Anônimo  │     │  UC-10 Ver Credencial Pública                       │
  └───────────┘     │                                                     │
        │           │  UC-01 Criar Conta                                  │
        │           │  UC-02 Fazer Login          UC-03 Recuperar Senha   │
        ▼           │  UC-04 Redefinir Senha                              │
  ┌───────────┐     │                                                     │
  │   Aluno   │────►│  UC-05 Atualizar Perfil     UC-06 Upload Avatar     │
  │Autenticado│     │  UC-07 Gerenciar Endereço   UC-08 Ver Credenciais   │
  └───────────┘     │  UC-09 Controlar Privacidade UC-11 Compartilhar LI  │
                    │                                                     │
  ┌───────────┐     │  UC-12 Gerenciar Cursos     UC-13 Gerenciar Turmas  │
  │   Admin   │────►│  UC-14 Gerenciar Inscrições UC-15 Cancelar Inscr.   │
  └───────────┘     │  UC-16 Emitir Credencial    UC-17 Compartilhar Drive│
                    │  UC-22 Emissão em Lote                              │
                    └─────────────────────────────────────────────────────┘
```

---

## Índice de Use Cases

### Autenticação e Acesso
| ID | Nome | Ator Principal |
|---|---|---|
| [UC-01](./uc-01-criar-conta.md) | Criar Conta | Visitante Anônimo |
| [UC-02](./uc-02-fazer-login.md) | Fazer Login | Aluno Autenticado |
| [UC-03](./uc-03-recuperar-senha.md) | Recuperar Senha | Aluno Autenticado |
| [UC-04](./uc-04-redefinir-senha.md) | Redefinir Senha | Aluno Autenticado |

### Perfil e Endereço
| ID | Nome | Ator Principal |
|---|---|---|
| [UC-05](./uc-05-atualizar-perfil.md) | Atualizar Perfil | Aluno Autenticado |
| [UC-06](./uc-06-upload-avatar.md) | Fazer Upload de Foto | Aluno Autenticado |
| [UC-07](./uc-07-gerenciar-endereco.md) | Gerenciar Endereço | Aluno Autenticado |

### Credenciais
| ID | Nome | Ator Principal |
|---|---|---|
| [UC-08](./uc-08-ver-credenciais.md) | Visualizar Minhas Credenciais | Aluno Autenticado |
| [UC-09](./uc-09-controlar-privacidade.md) | Controlar Privacidade da Credencial | Aluno Autenticado |
| [UC-10](./uc-10-ver-credencial-publica.md) | Visualizar Credencial Pública | Visitante Anônimo |
| [UC-11](./uc-11-compartilhar-linkedin.md) | Compartilhar Credencial no LinkedIn | Aluno Autenticado |

### Descoberta (Público)
| ID | Nome | Ator Principal |
|---|---|---|
| [UC-18](./uc-18-explorar-cursos.md) | Explorar Catálogo de Cursos | Visitante Anônimo |
| [UC-19](./uc-19-explorar-badges.md) | Explorar Badges de Certificação | Visitante Anônimo |
| [UC-20](./uc-20-galeria-certificados.md) | Visualizar Galeria de Certificados | Visitante Anônimo |
| [UC-21](./uc-21-documentacao.md) | Consultar Documentação do Framework | Visitante Anônimo |

### Administração
| ID | Nome | Ator Principal |
|---|---|---|
| [UC-12](./uc-12-gerenciar-cursos.md) | Gerenciar Cursos | Administrador |
| [UC-13](./uc-13-gerenciar-turmas.md) | Gerenciar Turmas | Administrador |
| [UC-14](./uc-14-gerenciar-inscricoes.md) | Gerenciar Inscrições | Administrador |
| [UC-15](./uc-15-cancelar-inscricao.md) | Cancelar Inscrição | Administrador |
| [UC-16](./uc-16-emitir-credencial.md) | Emitir Credencial para Aluno | Administrador |
| [UC-17](./uc-17-compartilhar-drive.md) | Compartilhar Pasta Google Drive | Administrador |
| [UC-22](./uc-22-emissao-em-lote.md) | Emitir Credencial em Lote via API | Administrador |
