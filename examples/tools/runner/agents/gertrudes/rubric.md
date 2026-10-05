# Rubrica de Qualidade da Gertrudes

Esta rubrica define o padrão mínimo de qualidade para os artefatos gerados pela agente Gertrudes.

A saída da agente deve ser útil para análise de produto, engenharia de software e continuidade da próxima agente.

---

## 1. Aderência ao domínio

### Critério
O conteúdo deve falar do produto correto e refletir o domínio descrito em intention.md e context.json.

### A saída é boa quando
- menciona explicitamente os conceitos centrais do produto
- usa os nomes corretos das entidades e fluxos
- respeita o contexto fornecido
- não muda o domínio do problema

### A saída é ruim quando
- transforma o produto em um sistema genérico
- inventa contexto não descrito
- mistura o produto com outro tipo de sistema
- introduz atores, entidades ou regras que não estavam implícitas nem explícitas

### Exemplos de erro
- introduzir professores quando o contexto não menciona professores
- transformar um sistema de matrícula em gestão de projetos
- inventar validação de histórico acadêmico sem base no contexto

---

## 2. Clareza

### Critério
Os requisitos devem ser claros, específicos e compreensíveis por pessoas de produto e engenharia.

### A saída é boa quando
- evita frases vagas
- descreve comportamento concreto
- usa linguagem objetiva
- deixa explícito quem faz o quê

### A saída é ruim quando
- usa termos como intuitivo, rápido, seguro, escalável, robusto sem explicar
- mistura vários comportamentos no mesmo requisito
- escreve frases genéricas que serviriam para qualquer sistema

---

## 3. Verificabilidade

### Critério
Cada requisito deve poder ser validado por análise, teste ou inspeção.

### A saída é boa quando
- descreve comportamentos observáveis
- explicita condições de sucesso ou erro
- permite derivar critérios de aceitação

### A saída é ruim quando
- escreve expectativas subjetivas
- não deixa claro como verificar o requisito
- usa termos absolutos sem contexto

---

## 4. Atomicidade

### Critério
Cada requisito deve representar uma ideia principal.

### A saída é boa quando
- separa funcionalidades distintas
- evita listas vagas dentro do mesmo requisito
- organiza requisitos por capacidade ou fluxo

### A saída é ruim quando
- junta várias responsabilidades em um só bloco
- mistura autenticação, matrícula e pagamento no mesmo requisito
- descreve o sistema inteiro como um requisito único

---

## 5. Rastreabilidade

### Critério
O conteúdo deve ser claramente derivável da intenção, do contexto ou das evidências.

### A saída é boa quando
- os requisitos podem ser associados a partes da intenção
- as suposições aparecem explicitamente
- as restrições do contexto reaparecem na documentação

### A saída é ruim quando
- o texto parece inventado
- não se percebe de onde veio a informação
- há saltos de interpretação sem explicitação

---

## 6. Controle de invenção

### Critério
A agente deve minimizar alucinação e expansão indevida de escopo.

### A saída é boa quando
- registra suposições em assumptions.md
- mantém o foco no que foi pedido
- evita inventar integrações, métricas e papéis

### A saída é ruim quando
- inventa números de desempenho ou escala
- inventa integrações externas
- inventa funcionalidades futuras
- trata hipótese como fato

---

## 7. Qualidade dos requisitos não funcionais

### Critério
Os requisitos não funcionais devem refletir a realidade do produto e não virar uma lista genérica.

### A saída é boa quando
- organiza os NFRs por categoria
- identifica aspectos realmente relevantes ao contexto
- inclui idempotência quando há webhook ou pagamento
- inclui auditabilidade quando há mudança de estado relevante
- inclui observabilidade quando há eventos e integrações

### A saída é ruim quando
- gera um bloco genérico de segurança, desempenho e escalabilidade
- inventa metas numéricas
- não conecta os NFRs aos fluxos reais do produto

---

## 8. Qualidade do glossário

### Critério
O glossário deve conter termos relevantes para o domínio do produto.

### A saída é boa quando
- define termos realmente úteis para as próximas etapas
- usa definições curtas e específicas
- evita termos óbvios demais

### A saída é ruim quando
- vira uma lista de termos genéricos
- define palavras fora do domínio
- não ajuda Corrinha nem Creuza

---

## 9. Qualidade das suposições

### Critério
As suposições devem explicitar incertezas reais.

### A saída é boa quando
- registra o que não estava claro
- justifica por que a suposição foi necessária
- não transforma suposição em regra fixa

### A saída é ruim quando
- inventa suposições desnecessárias
- usa suposições para expandir escopo
- registra obviedades sem valor analítico

---

## 10. Qualidade do handoff

### Critério
O handoff deve permitir que a Corrinha continue o trabalho sem perda de contexto.

### A saída é boa quando
- lista as entradas produzidas
- explica o que a próxima agente deve fazer
- destaca pontos críticos
- registra ambiguidades em aberto

### A saída é ruim quando
- vira um resumo genérico
- não ajuda a próxima etapa
- não aponta restrições importantes

---

## 11. Sinais de saída fraca

Considere a saída fraca se houver:

- domínio incorreto
- ausência de termos centrais do produto
- excesso de linguagem genérica
- presença de termos proibidos
- documentos vazios
- markdown contendo JSON bruto
- texto sem utilidade para engenharia
- inventar funcionalidades ou atores

---

## 12. Sinais de saída forte

Considere a saída forte se houver:

- forte aderência ao contexto
- linguagem específica
- requisitos verificáveis
- NFRs ligados ao fluxo real do produto
- glossário útil
- suposições honestas
- handoff acionável
- documentação pronta para evolução por Corrinha

---

## 13. Regra de decisão

Se a saída:
- contradizer o contexto
- inventar domínio
- não mencionar termos centrais do produto
- produzir artefatos vazios
- cair em genericidade excessiva

então ela deve ser tratada como inválida e precisa ser regenerada ou rejeitada.