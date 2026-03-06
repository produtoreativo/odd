AS-001: O Certificare é responsável pela autenticação e cadastro dos usuários.
Justificativa: O Schola não tem recursos para realizar a autenticação e cadastro, então o Certificare será utilizado.

AS-002: A confirmação de pagamento deve ser idempotente.
Justificativa: Se o sistema receber uma confirmação de pagamento duplicada, ele deve ignorá-la e não confirmar a matrícula novamente.

**handoff_md**

### Entradas
O Schola é um sistema para gerenciar novas turmas do curso de ProdOps. O sistema lista as turmas abertas para matrícula, permite solicitar matrícula e acompanha o status da matrícula. Além disso, o Schola recebe confirmação de pagamento via API e confirma a matrícula.

### Próximo passo
A próxima agente (Corrinha) deve criar as User Stories e Use Cases para o Schola, incluindo os requisitos funcionais e não funcionais. Além disso, ela deve criar os contratos de API para a integração com o Certificare.

### Pontos críticos
- O sistema deve garantir autenticação e autorização dos usuários.
- A confirmação de pagamento deve ser idempotente.
- O Schola deve ter disponibilidade alta e performance alta.
