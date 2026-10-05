# Capítulo 3 — A entropia do produto

Todo produto acumula informação. Parte dela é explícita: código, documentos, dashboards, runbooks. Parte está distribuída entre pessoas, decisões que nunca foram registradas, suposições que nunca foram questionadas e incidentes que foram resolvidos sem que a causa raiz fosse tornada pública.

Quanto mais difícil é reconstruir a história de uma decisão ou explicar o estado de uma jornada, maior é a incerteza operacional. Chamaremos essa condição de **entropia da informação do produto**.

O conceito não precisa ser tratado como uma fórmula. É uma condição operacional. E suas consequências são práticas.

![Loop bidirecional entre Entropia da Informação e Intercambiabilidade](../images/cap05-estrategia-prodops.png)

*A relação entre entropia e intercambiabilidade é cíclica: alta entropia reduz a capacidade de intercambiar partes do sistema de forma segura, e baixa intercambiabilidade mantém a organização presa a decisões que elevam ainda mais a entropia. Fonte: slide 67 da apresentação "ProdOps — Modelagem de Domínio com Confiabilidade, Parte 1".*

## Como a entropia se manifesta

Quando a organização não consegue enxergar bem, ela tende a iniciar mais coisas. Cada parte do sistema cria sua própria interpretação do que está acontecendo. Equipes diferentes tomam decisões localmente corretas que, em conjunto, produzem um comportamento que ninguém havia antecipado.

Três sintomas indicam alta entropia:

O primeiro é **sinais ruins**: alertas genéricos ou duplicados, sem contexto; dashboards com dados que contradizem uns aos outros; tudo classificado como prioridade máxima porque ninguém definiu o que é realmente crítico.

O segundo é **decisões em baixa confiança**: equipes incapazes de distinguir se um comportamento é esperado ou anômalo; informação que não chega à pessoa certa no momento certo; ausência de rastreabilidade entre causa e efeito.

O terceiro é **ruído maior que sinal**: muitos logs sem significado, alertas que não levam a nenhuma ação, notificações que são ignoradas porque ninguém acredita mais nelas.

O resultado é previsível. A organização compensa a falta de entendimento com execução. Mais WIP, mais reuniões, mais tentativas de coordenar manualmente aquilo que poderia ser previsível se o domínio fosse suficientemente compreendido.

## O princípio da visualização

Existe um princípio direto presente no material de referência: visualizar bem para limitar o WIP.

A visualização não é decoração. Ela reduz o espaço para trabalho invisível. Quando a jornada está mapeada, as dependências são conhecidas e os acontecimentos relevantes estão nomeados, o time consegue distinguir o que é urgente do que é apenas visível.

Esse princípio se conecta a uma afirmação mais ampla: adultos com boas informações tomam melhores decisões, independentemente do nível de senioridade. A senioridade não substitui a qualidade da informação. Ela apenas adiciona experiência no uso da informação disponível.

Quando a informação é pobre, a senioridade ajuda menos do que deveria.

## Group Buying: dependências que aparecem tarde

No Group Buying, imagine uma falha em que alguns pedidos permanecem associados a um grupo que expirou, enquanto o estoque correspondente já não pode atender a quantidade solicitada. O grupo foi encerrado. Os pedidos não foram cancelados. O cliente recebeu uma confirmação que o sistema não consegue honrar.

Se a jornada foi mapeada, os eventos foram nomeados e as dependências entre domínios são conhecidas, é possível localizar em qual ponto a coerência foi perdida. Se cada aplicação possui apenas sua própria visão, a falha aparece como uma sucessão de sintomas sem origem clara.

Esse é o custo da entropia. Não é a falha em si. É a incapacidade de entender a falha com rapidez suficiente para agir.

A entropia também aparece como dependência invisível. Um serviço pode depender de uma projeção que depende de uma atualização assíncrona que depende de um evento que pode chegar com atraso. Cada parte pode funcionar isoladamente. A jornada, no entanto, pode falhar silenciosamente.

## A relação entre entendimento e risco

A consequência central é simples: mais entendimento produz menos ambiguidade. Menos ambiguidade produz menos WIP inútil. Menos WIP inútil produz menos decisões escondidas. Menos decisões escondidas produz melhor capacidade de modelar confiabilidade. Melhor confiabilidade produz menor risco em produção.

ODD não resolve a entropia definitivamente. Nenhuma abordagem elimina a incerteza de um sistema que evolui. O que ODD procura é reduzir a incerteza no momento em que ela é mais gerenciável — antes que o domínio se transforme em compromisso de engenharia.

Uma vez que o código está em produção, a descoberta retroativa do domínio é possível, mas custosa. Os incentivos organizacionais raramente suportam parar para compreender o que já foi entregue. ODD propõe que esse trabalho aconteça antes.

---

*A organização não reduz risco apenas executando mais rápido. Ela reduz risco quando consegue tornar o sistema compreensível o bastante para decidir onde vale a pena colocar capacidade.*
