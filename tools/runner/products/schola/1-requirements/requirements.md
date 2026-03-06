### Visão do Produto
O Schola é um sistema para gerenciar novas turmas do curso de ProdOps, permitindo que os alunos vejam as turmas abertas, façam matrícula e tenham a matrícula confirmada após confirmação de pagamento.

### Objetivos
- Permitir que uma pessoa veja turmas abertas para matrícula.
- Permite solicitar matrícula em uma turma.
- Acompanhar o status da matrícula.
- Receber confirmação de pagamento por API e confirmar a matrícula.

### Escopo
O Schola lista turmas novas criadas para o curso de ProdOps, permite solicitar matrícula e acompanha o status. O sistema expõe uma API para receber confirmação de pagamento e confirmar a matrícula do aluno.

### Fora de Escopo
- Autenticação e cadastro de usuário.
- Integração com outras aplicações, exceto Certificare.

### Personas
- Aluno: usuário que deseja se matricular em uma turma.
- Admin ProdOps: responsável por criar e gerenciar as turmas.

### Jornadas do Usuário
1. O aluno acessa o Schola e vê as turmas abertas para matrícula.
2. O aluno solicita matrícula em uma turma.
3. O sistema confirma a matrícula após receber confirmação de pagamento.

### Requisitos Funcionais

RF-001: Redirecionar para login e cadastro usando Certificare e receber o retorno autenticado.
Critérios de Aceitação:
- O usuário é redirecionado para a página de login do Certificare.
- Após autenticação, o sistema retorna ao Schola com informações de autenticação.

RF-002: Listar turmas do curso de ProdOps que estão abertas para matrícula.
Critérios de Aceitação:
- O sistema lista as turmas abertas para matrícula.
- Cada turma tem informações sobre a data e horário da aula.

RF-003: Permitir que um usuário autenticado solicite matrícula em uma turma.
Critérios de Aceitação:
- O sistema permite ao usuário solicitar matrícula em uma turma.
- A solicitação é registrada no sistema com data e hora.

RF-004: Receber confirmação de pagamento por API e confirmar a matrícula do aluno.
Critérios de Aceitação:
- O sistema recebe confirmação de pagamento via API.
- A matrícula é confirmada após receber confirmação de pagamento.
