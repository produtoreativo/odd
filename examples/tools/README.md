# ODD Agents: Engenharia de Requisitos Assistida por IA

Este projeto implementa um pipeline de engenharia de requisitos
assistido por agentes de IA baseado em RAG (Retrieval Augmented
Generation) e um banco de conhecimento construído a partir de literatura
clássica de engenharia de requisitos.

O objetivo é transformar descrições iniciais de produtos em artefatos
estruturados de engenharia de requisitos.

------------------------------------------------------------------------

# Arquitetura Geral

Fluxo principal:

Product Intent → Knowledge Retrieval → Agent Pipeline → Structured
Requirements

------------------------------------------------------------------------

# Banco de Conhecimento

O sistema utiliza uma base de conhecimento indexada semanticamente
construída a partir de livros clássicos de engenharia de requisitos.

Processo:

1.  textos são fragmentados em chunks
2.  chunks são convertidos em embeddings
3.  vetores são armazenados em Qdrant
4.  agentes recuperam conteúdo relevante por similaridade semântica

------------------------------------------------------------------------

# Livros Utilizados

## Mastering the Requirements Process

Suzanne Robertson e James Robertson

## Software Requirements

Karl Wiegers

## Software Engineering Body of Knowledge

Referências conceituais de engenharia de software.

------------------------------------------------------------------------

# Banco Vetorial

Vector database utilizado:

Qdrant

Coleções:

odd\_\_requirements\_\_coarse\
odd\_\_requirements\_\_fine\
odd\_\_product\_\_coarse\
odd\_\_product\_\_fine\
odd\_\_architecture\_\_coarse\
odd\_\_architecture\_\_fine

------------------------------------------------------------------------

# Pipeline de Agentes

O sistema utiliza três agentes especializados.

## Gertrudes

Responsável por:

-   interpretar a intenção do produto
-   recuperar conhecimento da base vetorial
-   gerar requisitos funcionais
-   gerar requisitos não funcionais
-   criar glossário
-   registrar suposições

Artefatos gerados:

requirements.md\
non_functional.md\
glossary.md\
assumptions.md\
handoff_to_corrinha.md

------------------------------------------------------------------------

## Corrinha [TODO]

Responsável por:

-   converter requisitos em user stories
-   gerar use cases
-   definir contratos de API

------------------------------------------------------------------------

## CREUZA: Event Storming Agent [TODO]

Responsável por:

-   identificar eventos de domínio
-   identificar comandos
-   identificar agregados
-   gerar modelo de eventos

------------------------------------------------------------------------

# Execução

docker-compose exec airflow-scheduler bash -lc\
"python /opt/scripts/agents/gertrudes_run.py --product schola --root
/opt/products --force"

------------------------------------------------------------------------

# Tecnologias Utilizadas

LLM\
Ollama\
Llama

Embeddings\
BGE

Vector DB\
Qdrant

Orquestração\
Airflow

------------------------------------------------------------------------

# Objetivo

Demonstrar como IA pode automatizar partes da engenharia de software:

-   elicitação de requisitos
-   análise de domínio
-   modelagem de eventos
-   geração de artefatos
