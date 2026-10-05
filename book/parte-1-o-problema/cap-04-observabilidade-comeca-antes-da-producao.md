# Capítulo 4: Observabilidade começa antes da produção

Existe uma forma tardia de observar software: esperar o sistema entrar em produção e então decidir o que monitorar. Essa abordagem pode produzir muitos dados e pouca compreensão.

O problema não está nas ferramentas. O problema está em que a pergunta que deveria preceder a ferramenta raramente é feita: o que, nesta jornada, precisa permanecer confiável?

Quando essa pergunta não é respondida antes da produção, a observabilidade tende a refletir o que é tecnicamente possível medir, não o que é operacionalmente relevante observar. O resultado é um ambiente com alta densidade de dados e baixa capacidade de distinguir o que é crítico do que é apenas presente.

## O problema da métrica sem contexto

Uma métrica de infraestrutura pode mostrar que uma aplicação está respondendo dentro do tempo esperado enquanto uma regra de negócio já deixou de ser satisfeita. Um dashboard pode indicar que todos os serviços estão disponíveis enquanto uma jornada inteira falha silenciosamente porque a sequência de estados esperada foi interrompida.

Isso acontece porque disponibilidade técnica e confiabilidade da experiência são coisas diferentes.

No Group Buying, saber que o serviço de pagamentos está respondendo não é suficiente para afirmar que a jornada de compra em grupo está funcionando. Precisamos saber se os pedidos estão sendo associados ao grupo correto, se o estoque está reconciliado, se o encerramento automático está funcionando e se as notificações estão chegando nas condições certas.

Cada um desses pontos é uma preocupação de domínio antes de ser uma preocupação técnica.

## Observabilidade transacional e analítica

Uma distinção presente no material de referência é relevante aqui: observabilidade transacional e observabilidade analítica não precisam ser tratadas com a mesma ferramenta nem no mesmo plano.

![Múltiplas frentes de observabilidade: Domain Ecommerce, Domain Search Engine, Domain Payments e canais analíticos de Marketing](../images/cap04-frentes-observabilidade.png)

*O diagrama ilustra as múltiplas frentes de observabilidade em um produto de e-commerce real: o usuário inicia na tela de checkout, a jornada atravessa Domain Ecommerce (Webshop API, Magento, Elasticsearch, MySQL), Domain Search Engine (search-api) e Domain Payments (Stark Bank), enquanto o canal analítico de Marketing usa OneSignal e Mixpanel. Dev/Ops monitora com Sentry e Datadog. Cada frente tem sua própria natureza de observação. Fonte: slide 2 da apresentação "ProdOps — Modelagem de Domínio com Confiabilidade, Parte 2".*

O plano transacional está concentrado nas operações imediatas do sistema. Seu objetivo é facilitar a resposta direta e rápida. Quando um grupo é encerrado com status de erro crítico, o time precisa ser acionado imediatamente.

O plano analítico apoia decisões de médio e longo prazo. Taxas de conversão, padrões de abandono, comportamento de formação de grupos ao longo do tempo, essas informações são úteis para evolução do produto, mas não precisam estar no mesmo pipeline que os alertas operacionais.

Misturar os dois produz complexidade desnecessária e, com frequência, embota a capacidade de reagir. Quando tudo é igualmente observável, nada é prioritariamente observável.

## A decisão sobre o que merece ser observado

A decisão sobre o que merece ser observado é uma decisão de domínio.

Ela depende de conhecer a jornada, os eventos que a compõem, as entidades que mudam durante a jornada e as dependências que podem comprometer a experiência. Sem esse conhecimento, a escolha do que monitorar tende a ser feita por critérios técnicos, o que é mais fácil de instrumentar, o que a ferramenta já expõe por padrão, em vez de critérios de negócio.

Por isso observabilidade começa antes da produção. Não porque dashboards precisem ser criados antes do lançamento, mas porque a pergunta sobre o que observar precisa ser respondida enquanto o domínio ainda está sendo compreendido.

Quando essa pergunta é respondida durante a descoberta do domínio, a observabilidade deixa de ser um conjunto de painéis acrescentados ao final do desenvolvimento. Ela passa a ser consequência direta do que foi compreendido sobre a jornada.

## Três regras que guiam a operação

O material de referência estabelece três princípios operacionais que se conectam diretamente a essa preocupação.

O primeiro é colocar em produção mais rápido, não como um fim em si mesmo, mas como forma de encurtar o ciclo de feedback entre o que foi construído e o que o cliente experimenta. O segundo é jogar o incidente mais longe possível, circuit breakers, retries, failovers; mecanismos que reduzem a superfície de impacto de uma falha antes que ela afete a experiência. O terceiro é reagir imediato, alertas acionáveis, runbooks, war rooms; a capacidade de responder rapidamente depende de que a observabilidade já saiba o que perguntar.

Os três princípios dependem de um domínio suficientemente compreendido. Não é possível jogar o incidente mais longe se não se sabe qual parte da jornada está em risco. Não é possível reagir imediato se os alertas não têm contexto de negócio suficiente para direcionar a ação.

---

*Não observamos porque temos uma ferramenta. Observamos porque existe algo relevante que decidimos compreender continuamente.*
