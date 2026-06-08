# Regras Portáveis de Desenho para Event Storming

Este documento consolida regras de desenho para que uma imagem de Event Storming seja interpretada de forma consistente por pessoas e por mecanismos automatizados de leitura visual, como OCR, análise geométrica e composição semântica.

O objetivo do desenho é representar uma transação de negócio, síncrona ou assíncrona, com um caminho feliz principal e possíveis rotas alternativas da mesma transação.

## Princípios Gerais

- O desenho deve representar uma jornada transacional de negócio, não apenas uma coleção solta de eventos.
- A value stream de um Event Storming representa uma transação de negócio.
- A ordem de lançamento dos eventos deve seguir a execução da transação, seja ela síncrona ou assíncrona.
- A leitura principal é feita da esquerda para a direita e, quando necessário, de cima para baixo.
- Cada evento precisa estar visualmente associado a um touch point, bounded context, etapa ou caixa operacional.
- Caminhos alternativos não são transações isoladas: eles são variações da mesma transação principal.
- O caminho feliz deve deixar claro o fluxo base da transação.
- Rotas alternativas devem deixar claro onde divergem do caminho feliz e, quando aplicável, onde retornam a ele.
- Textos estruturais, labels de áreas, atores e integrações não devem competir visualmente com eventos de domínio.

## Perfis Visuais Recomendados

Para reduzir ambiguidades de leitura, use um dos dois perfis visuais abaixo. Eles são independentes de ferramenta e podem ser aplicados em qualquer projeto.

### Perfil A: Eventos Fora dos Touch Points

Este perfil privilegia leitura humana e automatizada por separação visual explícita entre eventos, touch points, áreas e rotas.

Regras esperadas:

- Touch points devem ser caixas simples, com label centralizada.
- Eventos devem ficar fora da caixa do touch point, preferencialmente acima, abaixo ou imediatamente ao lado da caixa.
- Eventos protagonistas e coadjuvantes podem aparecer próximos ao mesmo touch point, mas sem entrar na área textual da label do touch point.
- Setas conectam touch points e/ou pontos de passagem da transação.
- Branches alternativos usam setas tracejadas próximas ao ponto de divergência e, quando houver retorno, próximas ao ponto de reentrada.
- Áreas macro devem ser poucas e grandes, como `Sistema de Registro`, `Provedores Externos`, `Backoffice`, `Cliente` ou `Integrações`.
- A legenda lateral deve explicitar a sequência completa do caminho feliz e das rotas alternativas.

Exemplo visual conceitual:

```text
Caminho Feliz:
Evento A
Evento B
Evento C

[Área Macro]
  Evento A
  [Touch Point 1] ----> Evento C
                      [Touch Point 2]

  Evento B
  - - - - - - - - -> [Touch Point Alternativo]
```

### Perfil B: Evento Técnico Acima do Touch Point

Este perfil é útil quando os eventos precisam manter nomes técnicos ou canônicos, preservando uma associação direta com o touch point de negócio.

Regras esperadas:

- O touch point continua sendo uma caixa simples com label de negócio.
- O evento técnico principal aparece em vermelho, pequeno, acima ou muito próximo do touch point.
- Eventos de suporte, atores ou papéis podem ser indicados por ícones ou labels estruturais, mas devem ficar separados do nome do evento.
- A ordem é determinada principalmente por setas e posição espacial.
- Quando não houver legenda, o desenho deve ter setas limpas e sequência visual inequívoca.
- Use esse perfil quando os eventos forem nomes técnicos ou canônicos, como `dominio.contexto.acao.concluida`.

Exemplo visual conceitual:

```text
evento.tecnico.concluido
[Touch Point de Negócio] ----> proximo.evento.tecnico
                               [Proximo Touch Point]
```

### O Que Evitar para Leitura Consistente

- Não use cartões grandes empilhando touch point, evento azul e evento vermelho dentro da mesma coluna quando isso fizer o evento parecer conteúdo interno da caixa.
- Não coloque uma área alternativa enorme distante do ponto de divergência sem uma seta curta e clara.
- Não use uma caixa chamada apenas `(async)` como touch point; represente async como seta/canal estrutural.
- Não deixe a legenda apenas como blocos coloridos sem cabeçalho textual.
- Não cruze setas diagonais longas por cima de áreas e eventos.
- Não misture múltiplas transações independentes na mesma value stream sem separá-las visualmente.
- Não use labels técnicos de endpoint como nome principal do touch point quando houver nome de negócio disponível.

## Semântica Transacional

Uma value stream deve ser desenhada como a execução de uma transação de negócio de ponta a ponta.

Regras esperadas:

- A sequência visual dos eventos representa a ordem em que a transação evolui.
- A transação pode atravessar touch points de forma síncrona ou assíncrona.
- Cada touch point lança seu evento protagonista como último evento da sua própria ação dentro da transação.
- O evento protagonista deve estar no passado porque representa o encerramento da ação daquele touch point.
- Eventos coadjuvantes podem representar entradas, consultas, pré-condições, respostas intermediárias ou fatos auxiliares necessários para o touch point concluir sua ação.
- Quando um touch point aciona outro de forma síncrona, ele deve aguardar a conclusão do touch point acionado antes de lançar seu próprio evento protagonista final.
- Quando um touch point aciona outro de forma assíncrona, o desenho deve deixar claro que o touch point antecessor encerrou sua participação e que a continuação da transação ocorrerá em outro ramo, fila, callback, integração ou momento posterior.
- A exceção para a espera síncrona só deve ocorrer quando o retorno assíncrono estiver visualmente representado no modelo.

Exemplo síncrono:

```text
Touch Point A inicia ação
-> Touch Point B é acionado
-> Touch Point B lança Evento B Concluido
-> Touch Point A, agora com a resposta de B, lança Evento A Concluido
```

Exemplo assíncrono:

```text
Touch Point A publica solicitação
-> Touch Point A lança Solicitacao Publicada
-> Touch Point B continua a transação posteriormente
-> Touch Point B lança Processamento Concluido
```

### Como Representar Encerramento Local Assíncrono

Quando um touch point assíncrono já encerrou seu trabalho local, mas a transação da value stream ainda não terminou, o desenho deve mostrar duas conclusões diferentes:

- conclusão local do touch point;
- continuação da transação em outro ponto, mecanismo ou momento.

Padrão visual recomendado:

```text
Touch Point A
[Solicitacao Recebida]
[Mensagem Publicada]  <-- evento protagonista final do Touch Point A

        - - - - - - - - - - - - - - - >
        async: fila / topico / callback / job

Touch Point B
[Mensagem Consumida]
[Processamento Concluido]
```

Regras esperadas:

- O touch point que encerrou localmente deve lançar um evento protagonista vermelho no passado.
- Esse evento representa o fim da responsabilidade daquele touch point, não o fim da transação inteira.
- A continuação assíncrona deve sair desse evento final por uma seta tracejada ou por um canal visual explicitamente assíncrono.
- A seta ou canal assíncrono deve ter label estrutural clara, como `async`, `fila`, `topico`, `callback`, `webhook`, `job assincrono`, `mensageria` ou `evento publicado`.
- O próximo touch point deve iniciar a retomada da transação com um evento de entrada, consumo ou recebimento.
- A retomada pode acontecer no mesmo caminho visual, em outro ramo ou em uma área separada, desde que a continuidade da value stream fique clara.

Exemplos de eventos protagonistas finais para o touch point que encerra localmente:

- `Pagamento Solicitado`
- `Solicitacao Publicada`
- `Pedido Enfileirado`
- `Comando Enviado`
- `Mensagem Publicada`
- `Evento Publicado`

Exemplos de eventos de retomada no touch point seguinte:

- `Mensagem Recebida`
- `Evento Consumido`
- `Callback Recebido`
- `Webhook Recebido`
- `Job Iniciado`
- `Solicitacao Assincrona Recebida`

Exemplo aplicado:

```text
Checkout
[Intencao de Pagamento Salva]
[Pagamento Solicitado]

        - - - - - async: payment_requested - - - - ->

Processador de Pagamentos
[Solicitacao de Pagamento Recebida]
[Pagamento Pendente]
[Fatura Criada]
```

Regra prática:

- Se o touch point encerrou localmente mas a value stream continua, desenhe o evento final dele no passado e conecte a continuação com uma seta tracejada ou canal assíncrono explícito.

Implicação para o desenho:

- Não posicione o evento protagonista final de um touch point antes dos eventos de um touch point acionado quando a relação for síncrona.
- Use seta, separação visual, legenda ou nota estrutural para indicar quando a relação é assíncrona.
- O evento protagonista final de cada touch point deve marcar claramente o momento em que aquele touch point encerrou sua responsabilidade naquela transação.

## Eventos

Eventos são os textos principais que descrevem fatos já ocorridos na transação.

Regras esperadas:

- Eventos protagonistas devem usar label técnica vermelha.
- Eventos coadjuvantes ou de suporte devem usar label técnica azul.
- Eventos devem ser escritos como fatos no passado ou como nomes técnicos inequívocos.
- O evento protagonista de um touch point deve representar o encerramento da ação daquele touch point dentro da transação.
- Cada evento deve ter texto legível, com bom contraste e sem sobreposição.
- Eventos técnicos podem usar nomes como `dominio.subdominio.evento`.
- Eventos não devem ser desenhados dentro de labels de área ou confundidos com nomes de touch point.
- Fragmentos de texto devem ser evitados; mecanismos de leitura podem remover fragmentos quando eles estão contidos em labels mais completas.

Convenção de cor recomendada:

| Cor | Papel | Uso |
| --- | --- | --- |
| Vermelho `#FF0000` | Protagonist | Evento principal, mudança relevante de estado da transação |
| Azul `#305CDE` | Supporting | Evento auxiliar, condição, evidência, consulta, complemento ou suporte ao evento protagonista |

## Touch Points

Touch points são caixas, etapas, canais, telas, serviços ou pontos operacionais pelos quais a transação passa.

Regras esperadas:

- Cada touch point deve ter uma label textual clara.
- A label deve ficar dentro ou muito próxima da caixa correspondente.
- A label deve ser curta o suficiente para ser lida com segurança por pessoas e por mecanismos de OCR.
- A caixa do touch point deve ter borda visível e fundo claro.
- O texto do touch point deve ficar centralizado e não deve ser sobreposto por eventos.
- O touch point deve representar uma responsabilidade de negócio, canal, tela, serviço ou integração da transação.
- A label não deve usar formato técnico com pontos, como `a.b.c`, porque isso é interpretado como possível evento técnico.
- A label não deve ser uma palavra estrutural fraca, como apenas `user`, `system`, `actor`, `integration`, `ok`, `true` ou `false`.
- Labels de touch point devem estar próximas dos eventos associados.
- Touch points muito próximos podem ser mesclados por leitura automatizada se parecerem fragmentos adjacentes da mesma label.

Boas práticas:

- Use nomes de negócio, por exemplo `Checkout`, `Processamento`, `Cadastro`, `Autenticação`, `Backoffice` ou `Integração Externa`.
- Evite labels muito longas, com mais de dez palavras.
- Evite abreviações muito curtas ou sem vogais, pois tendem a ser tratadas como ruído em leituras automatizadas.
- Evite repetir a mesma palavra várias vezes na mesma label.
- Se precisar mostrar endpoint, método HTTP, fila ou tópico, coloque como texto estrutural menor fora da label principal.

## Áreas e Agrupamentos

Áreas são regiões grandes que agrupam touch points ou partes do desenho.

Regras esperadas:

- Áreas devem ser visualmente maiores que touch points.
- Uma área pode ser detectada quando ocupa uma parte grande da imagem, uma largura grande ou uma altura grande.
- A label de uma área não deve colidir com eventos.
- A label de uma área não deve ser igual ou equivalente à label de um touch point.
- Áreas são estruturais; elas não devem ser usadas como eventos.

Boas práticas:

- Use áreas para indicar domínio, contexto, macro etapa ou agrupamento.
- Mantenha eventos e touch points visualmente dentro da área correspondente.
- Não use uma área como substituta de fluxo. O fluxo deve continuar representado por ordem, setas ou legenda.

## Setas e Fluxos

Setas indicam a direção narrativa da transação.

Convenção recomendada:

| Seta | Interpretação |
| --- | --- |
| Seta sólida | Caminho principal ou caminho feliz |
| Seta tracejada | Caminho alternativo |

Regras esperadas:

- Use setas sólidas para conectar a sequência principal da transação.
- Use setas tracejadas para indicar divergências, exceções, compensações ou alternativas.
- A direção preferencial é esquerda para direita.
- Quando o fluxo for vertical, mantenha alinhamento claro de cima para baixo.
- Setas devem ter contraste escuro e não devem se confundir com bordas de caixas.
- Setas tracejadas devem ter pelo menos três segmentos pequenos alinhados para serem detectadas com mais confiança.

Limitação comum:

- As setas ainda são detectadas como geometria e estilo, não como um grafo completo `origem -> destino`.
- Por isso, legenda e proximidade espacial continuam sendo importantes para inferir ordem e associação.

## Legenda de Fluxo

A legenda de fluxo é usada para explicitar a ordem dos eventos quando a geometria sozinha não é suficiente.

Cabeçalhos recomendados:

- `Caminho Feliz`
- `Caminho Principal`
- `Caminho Alternativo`
- `Fluxo Principal`
- `Fluxo Alternativo`
- `Happy Path`
- `Alternate Path`

Regras esperadas:

- A legenda deve ter um cabeçalho claro.
- Os eventos da legenda devem aparecer abaixo do cabeçalho.
- Os itens devem estar próximos verticalmente do cabeçalho.
- Os itens devem estar aproximadamente alinhados ao cabeçalho.
- A legenda deve listar os eventos na ordem narrativa esperada.
- Para maior previsibilidade, liste a rota completa em cada legenda, não apenas o delta do branch.
- A legenda do caminho feliz deve conter todos os eventos protagonistas e coadjuvantes necessários para reconstruir a transação.
- A legenda de cada rota alternativa deve repetir o prefixo compartilhado, listar os eventos específicos do branch e repetir o sufixo quando houver retorno ao caminho feliz.
- Use a mesma grafia dos eventos na legenda e no desenho.
- Não use apenas cartões coloridos sem o texto `Caminho Feliz` ou `Caminho Alternativo`.

Importante:

- A legenda pode listar apenas os eventos específicos de uma rota alternativa.
- Um mecanismo de composição semântica pode entender que uma rota alternativa pertence à mesma transação e compô-la com prefixo e sufixo do caminho feliz.
- Mesmo assim, quanto mais explícito o desenho for sobre divergência e retorno, menor será a ambiguidade.
- Quando o objetivo for máxima previsibilidade, prefira legenda completa por rota.

## Caminho Feliz

O caminho feliz é a rota principal da transação de negócio.

Regras esperadas:

- Deve existir no máximo um caminho principal dominante.
- O caminho principal deve conter a sequência mais completa e comum da transação.
- Ele é usado como base para compor rotas alternativas.
- Se houver legenda, o caminho principal deve estar identificado como `Caminho Feliz`, `Caminho Principal`, `Fluxo Principal` ou equivalente.
- Se não houver legenda, a ordem é inferida por posição espacial e setas.

Exemplo conceitual:

```text
Intencao de Pagamento salva
-> Cliente Encontrado
-> Pagamento Pendente
-> Fatura Criada
```

## Rotas Alternativas

Rotas alternativas são variações da mesma transação, não eventos avulsos fora do caminho feliz.

Regras esperadas:

- Uma rota alternativa deve estar ligada ao caminho principal por seta tracejada, legenda ou proximidade visual clara.
- A rota alternativa deve indicar quais eventos substituem, complementam ou desviam um trecho do caminho feliz.
- Se a rota retorna ao caminho feliz, o desenho deve mostrar visualmente esse retorno.
- Se a rota encerra a transação sem retorno, isso deve ficar claro no desenho.
- O ponto de divergência deve sair do evento ou touch point imediatamente anterior ao desvio.
- O ponto de retorno deve entrar no evento ou touch point em que a rota volta a compartilhar o caminho feliz.
- Se a alternativa substitui um evento do caminho feliz, o nome deve deixar a substituição evidente quando possível.
- Uma alternativa que encerra a transação deve ter um evento protagonista final claro, como `Conta Nao Criada`, `Reset Negado` ou `Acesso Bloqueado`.
- Evite desenhar alternativas em grandes áreas isoladas sem repetir a rota completa na legenda.

Composição semântica recomendada:

- A interpretação semântica seleciona o caminho principal.
- Para cada fluxo alternativo, identifica se ele parece conter apenas os eventos específicos do branch.
- Quando encontra um ponto de substituição provável no caminho principal, compõe a rota completa:

```text
prefixo do caminho principal
+ eventos específicos do caminho alternativo
+ sufixo do caminho principal
```

Exemplo:

```text
Caminho Feliz:
Intencao de Pagamento salva
Cliente Encontrado
Pagamento Pendente
Fatura Criada

Caminho Alternativo:
Cliente Nao Encontrado
Cliente Cadastrado
```

Rota alternativa compreendida:

```text
Intencao de Pagamento salva
Cliente Nao Encontrado
Cliente Cadastrado
Pagamento Pendente
Fatura Criada
```

Boas práticas:

- Use nomes com algum vocabulário compartilhado entre o evento substituído e o evento alternativo, quando isso fizer sentido.
- Exemplo: `Cliente Encontrado` e `Cliente Nao Encontrado` ajudam a identificar o ponto de substituição.
- Evite desenhar o branch longe demais do ponto de divergência.
- Evite listar eventos alternativos sem qualquer conexão visual com a transação principal.
- Use setas tracejadas curtas para divergência e retorno; se precisar cruzar grandes áreas, prefira uma legenda completa para compensar a ambiguidade visual.

## Correlação Evento para Touch Point

A correlação entre eventos e touch points deve ser compreensível por proximidade espacial, ordem de fluxo e associação visual explícita.

Regras esperadas:

- Eventos devem estar próximos do touch point ao qual pertencem.
- Eventos coadjuvantes azuis próximos de um protagonista vermelho tendem a acompanhar o mesmo touch point do protagonista.
- Quando há um branch alternativo, os eventos de suporte do branch devem ficar próximos do evento protagonista alternativo.
- O desenho deve evitar colocar um evento de branch dentro da área visual do touch point do caminho feliz se ele pertence a outro touch point.

Exemplo:

```text
Cobrança via Checkout:
- Intencao de Pagamento salva
- Cliente Encontrado
- Pagamento Pendente

Cobrança Cadastrada:
- Cliente Nao Encontrado
- Cliente Cadastrado
```

## Textos Estruturais

Textos estruturais são textos que ajudam a explicar o desenho, mas não devem ser tratados como eventos, touch points ou áreas.

Exemplos:

- nomes de atores;
- nomes de integrações;
- notas auxiliares;
- headers visuais;
- labels de papéis.

Regras esperadas:

- Textos estruturais devem ficar visualmente separados dos eventos.
- Não use a mesma cor técnica dos eventos para textos estruturais.
- Evite posicionar textos estruturais dentro ou imediatamente ao lado de labels de eventos.
- Evite nomes estruturais curtos demais que possam ser confundidos com labels.

## Qualidade Visual para Leitura Automatizada

Regras práticas:

- Use imagem em boa resolução.
- Use fonte legível e tamanho suficiente.
- Evite textos inclinados.
- Evite sobreposição entre texto, seta e borda de caixa.
- Evite sombras, transparências e fundos com pouco contraste.
- Mantenha margem entre eventos e bordas de touch points.
- Prefira labels completas em uma linha ou em quebras naturais.
- Evite quebrar uma palavra entre linhas.
- Evite símbolos decorativos próximos dos textos técnicos.

## Checklist para Imagens Novas

Use esta checklist quando o objetivo for gerar imagens consistentes, reutilizáveis entre projetos e adequadas para leitura humana ou automatizada.

- A imagem tem uma única value stream principal por arquivo.
- O caminho feliz pode ser reconstruído só pela legenda ou só pelas setas.
- Cada rota alternativa pode ser reconstruída pela legenda completa ou por branch/rejoin visual explícito.
- As áreas macro são poucas, grandes e com labels estruturais.
- Touch points são caixas simples, com label de negócio centralizada.
- Eventos ficam fora do texto interno do touch point.
- Eventos técnicos usam vermelho e, quando possível, ficam acima do touch point correspondente.
- Eventos de suporte usam azul e ficam próximos do protagonista que ajudam a concluir.
- Setas sólidas representam continuidade principal.
- Setas tracejadas representam alternativa, async ou retorno assíncrono.
- Toda seta tracejada tem label estrutural legível quando representa async.
- O desenho não depende de texto minúsculo para explicar uma divergência importante.
- A legenda usa exatamente os mesmos nomes de eventos desenhados na imagem.
- A legenda tem cabeçalho textual visível, como `Caminho Feliz:` e `Caminho Alternativo:`.
- Cada evento vermelho está no passado e representa encerramento de responsabilidade local.
- Canais async aparecem como seta/canal, não como touch point genérico.
- Endpoints, métodos HTTP, filas e tópicos são detalhes estruturais, não o nome principal do touch point.
- Branches alternativos longos repetem a rota completa na legenda.
- Branches alternativos curtos ficam próximos do ponto de divergência.
- Branches que encerram a transação têm evento final explícito.
- Branches que retornam ao fluxo principal têm seta de retorno explícita.

## Regras para Evitar Ambiguidade

Evite:

- evento com a mesma label de um touch point;
- touch point com formato técnico `a.b.c`;
- legenda muito distante dos seus itens;
- seta tracejada sem conexão visual com o branch;
- branch alternativo sem ponto claro de divergência;
- branch alternativo sem indicação de retorno ou encerramento;
- múltiplos caminhos principais concorrentes;
- labels repetidas em caixas diferentes;
- nomes de áreas iguais a nomes de touch points;
- eventos desenhados dentro de caixas que representam apenas agrupamento macro.

## Checklist para Criar um Desenho Compatível

- Existe um caminho feliz principal?
- O caminho feliz está ordenado visualmente ou por legenda?
- Eventos protagonistas estão em vermelho?
- Eventos coadjuvantes estão em azul?
- Cada evento está próximo de um touch point?
- Touch points têm labels claras e não técnicas?
- Áreas não têm labels conflitantes com eventos ou touch points?
- Setas sólidas indicam o fluxo principal?
- Setas tracejadas indicam rotas alternativas?
- Cada rota alternativa tem divergência clara?
- Cada rota alternativa mostra retorno ao caminho feliz ou encerramento?
- A legenda, se existir, usa cabeçalhos reconhecíveis?
- Os textos estão legíveis e sem sobreposição?

## Limitações Comuns da Interpretação Automática

- Muitos mecanismos de leitura visual ainda não constroem um grafo completo de setas com origem e destino.
- O retorno de uma rota alternativa ao caminho principal pode ser inferido por composição semântica quando não existe um grafo explícito de origem e destino.
- A legenda ajuda muito quando a geometria da imagem é complexa.
- OCR pode errar acentos, cedilha e fragmentar labels; o desenho deve evitar depender de correções posteriores.
- Labels de touch point muito curtas ou ruidosas podem ser descartadas.
- Elementos visuais muito grandes podem ser classificados como áreas em vez de touch points.

## Contrato Semântico

O desenho deve ser compreendido como:

```text
Transação de negócio
├── Caminho feliz principal
├── Rotas alternativas da mesma transação
├── Eventos protagonistas e coadjuvantes
├── Touch points que executam ou observam eventos
├── Áreas que agrupam contexto
└── Setas e legendas que indicam ordem, divergência e retorno
```

Esse contrato é a base para transformar um desenho de Event Storming em artefatos estruturados, como observações da imagem, eventos candidatos, contexto reconhecido ou documentação operacional.
