export type SupportedLocale = 'pt-BR' | 'en';

type I18nValues = Record<string, string | number | boolean | null | undefined>;

const ptBR = {
  'feedback.none': 'Nenhum.',
  'locale.invalid': 'Locale inválido: {locale}. Use pt-BR ou en.',
  'log.entry.normalizedArgs': 'Argumentos normalizados para execução',
  'log.entry.failed': 'Execução encerrada com falha',
  'log.workflow.start': 'Iniciando execução do workflow',
  'log.workflow.summary': 'Resumo final do workflow',
  'log.workflow.incomplete': 'Workflow retornou estado incompleto',
  'log.ocr.technical.start': 'Iniciando OCR técnico de labels',
  'log.ocr.technical.done': 'OCR técnico concluído',
  'log.ocr.supporting.start': 'Iniciando OCR técnico de labels azuis',
  'log.ocr.supporting.done': 'OCR técnico azul concluído',
  'log.context.candidateToRecognized': 'Convertendo eventos candidatos em contexto reconhecido',
  'log.context.imageToCandidates': 'Convertendo observação da imagem em candidatos determinísticos',
  'log.context.noReview': 'Nenhuma revisão fornecida; usando contexto determinístico derivado dos candidatos',
  'log.context.applyReview': 'Aplicando revisão de normalização',
  'log.workflow.reassignments': 'Reatribuições determinísticas de source_touch_point aplicadas',
  'error.workflowIncomplete': 'Workflow incompleto. Falhas: {failures}',
  'error.workflowNoDetails': 'Workflow falhou sem detalhes.',
  'ocr.technicalUnavailable': 'OCR técnico não estava disponível para classificar eventos por cor.',
  'ocr.technicalReviewNeeded': 'OCR clássico detectou texto {color} técnico, mas a baixa confiança ou caracteres ambíguos exigem revisão visual.',
  'ocr.technicalTrusted': 'OCR clássico detectou texto {color} técnico com confiança suficiente; pela regra de cor, é candidato {role}.',
  'ocr.fragmentsRemoved': '{count} fragmento(s) de OCR foram removidos por estarem contidos em labels mais completas da mesma cor.',
  'ocr.eventsCoverage': 'Eventos detectados por OCR nesta etapa cobrem labels técnicas vermelhas e azuis; formas, setas e fluxo são tratados por steps geométricos posteriores.',
  'ocr.redLowConfidence': 'OCR detectou labels técnicas com baixa confiança ou caracteres ambíguos; use a imagem original para revisar antes de tratar como definitivo.',
  'ocr.blueLowConfidence': 'OCR azul detectou labels coadjuvantes com baixa confiança ou caracteres ambíguos; revise antes de tratar como definitivo.',
  'ocr.flowLegendMissing': 'OCR clássico não encontrou legenda explícita de fluxo; a ordem precisará usar geometria/setas ou revisão visual.',
  'ocr.preprocessedRed': 'Imagem preprocessada usada pelo OCR vermelho: {path}',
  'ocr.preprocessedBlue': 'Imagem preprocessada usada pelo OCR azul: {path}',
  'ocr.reviewCrop': 'Crop ampliado para revisão OCR {index}. Transcreva a label técnica visualmente; não use a hipótese OCR como definitiva.',
  'shape.componentReasoning': 'Componente conectado não branco, sem pixels dominantes de labels vermelhas/azuis ou setas escuras.',
  'shape.geometryAssumption': 'Detecção geométrica usa componentes conectados de regiões não brancas; retângulos sobrepostos são mesclados antes da classificação.',
  'shape.labelAssumption': 'Labels textuais de touch points são extraídas por OCR localizado no crop de cada caixa quando possível.',
  'shape.labelCropReasoning': 'Label textual extraída por OCR localizado no crop da caixa.',
  'shape.mergedReasoning': 'Mesclado com {id} por sobreposição geométrica.',
  'arrow.solidReasoning': 'Segmento escuro longo detectado por geometria clássica; tratado como seta sólida candidata.',
  'arrow.dashedReasoning': 'Múltiplos segmentos escuros pequenos alinhados foram agrupados como seta tracejada candidata.',
  'arrow.none': 'Nenhuma seta foi detectada por geometria clássica com confiança mínima.',
  'arrow.assumption': 'Setas são heurísticas por segmentos escuros; pontas de seta e direção podem exigir revisão visual.',
  'flow.legendHeaderReasoning': 'Cabeçalho de legenda de fluxo detectado por OCR geral; itens próximos abaixo foram tratados como ordem narrativa.',
  'spatial.assumption': 'Composição espacial determinística usa proximidade entre bbox de evento e bbox de forma; relações podem precisar de revisão quando há sobreposição visual.',
  'spatial.unlabeledShape': '{id} não recebeu label textual confiável por OCR e foi nomeado por índice.',
  'touchPoint.ocrCandidateReasoning': 'Touch point candidato criado por OCR textual confiável quando a geometria da caixa é ambígua.',
  'correlation.nearestBbox': 'Correlação criada por menor distância entre bbox do evento OCR e bbox da caixa candidata.',
  'flow.legendReasoning': 'Fluxo derivado deterministicamente da legenda OCR; touch points foram aproximados por geometria.',
  'flow.detectedMainName': 'Fluxo Principal Detectado',
  'flow.detectedAlternateName': 'Fluxo Alternativo Detectado',
  'flow.spatialWithArrow': 'Fluxo ordenado por posição espacial dos eventos e anotado com a primeira seta detectada.',
  'flow.spatialNoArrow': 'Fluxo ordenado por posição espacial dos eventos; nenhuma seta confiável foi detectada.',
  'semantic.deterministicClassification': 'Classificação determinística: label técnica {color} detectada por OCR clássico.',
  'genai.reviewLowConfidence': 'Validar visualmente itens com baixa confiança dos steps determinísticos.',
  'genai.complementMissing': 'Complementar labels ou estruturas que os detectores clássicos não tenham encontrado.',
  'genai.resolveAmbiguities': 'Resolver ambiguidades de direção de seta, nome de touch point e associação espacial quando a heurística não for suficiente.',
  'observation.deterministicAssumption': 'Observação gerada deterministicamente antes do prompt observe-image.',
  'observation.uncertainItems': 'Os itens {items} foram tratados como estruturais ou ambíguos e não como eventos.',
  'observation.droppedTouchPoints': 'Os touch points {items} foram removidos por colidirem com labels de eventos outside; mantida apenas a leitura como evento.',
  'correlation.rebuilt': 'Correlação reconstruída deterministicamente a partir de flowsDetected.orderedEventTitles e do papel de cada evento.',
  'context.flowDerived': 'Fluxo derivado de {name}.',
  'context.flowAssociated': 'Fluxo associado a {name}.',
  'context.flowFromObservation': 'Fluxo derivado deterministicamente da observação da imagem.',
  'context.flowMain': 'Fluxo principal identificado por setas sólidas.',
  'context.flowAlternate': 'Fluxo alternativo identificado por setas tracejadas.',
  'context.flowVisual': 'Fluxo identificado visualmente na imagem.',
  'context.arrowSolid': 'Setas sólidas observadas.',
  'context.arrowDashed': 'Setas tracejadas observadas.',
  'context.arrowUnknown': 'Estilo de seta inconclusivo.',
  'context.consolidatedFlow': 'Fluxo consolidado automaticamente a partir dos eventos reconhecidos.',
  'workbook.mappingStage': 'stage = domain + subdomain derivados do touch point principal e consolidados em slug.',
  'workbook.mappingActor': 'actor foi normalizado para system quando a imagem não traz ator operacional confiável.',
  'workbook.mappingService': 'service = domain.subdomain, derivado do touch point e do contexto do evento.',
  'workbook.mappingTags': 'tags seguem o padrão touch_point:<slug>,business_domain:<slug>.'
} as const;

type I18nKey = keyof typeof ptBR;

const en: Record<I18nKey, string> = {
  'feedback.none': 'None.',
  'locale.invalid': 'Invalid locale: {locale}. Use pt-BR or en.',
  'log.entry.normalizedArgs': 'Normalized arguments for execution',
  'log.entry.failed': 'Execution failed',
  'log.workflow.start': 'Starting workflow execution',
  'log.workflow.summary': 'Final workflow summary',
  'log.workflow.incomplete': 'Workflow returned incomplete state',
  'log.ocr.technical.start': 'Starting technical label OCR',
  'log.ocr.technical.done': 'Technical OCR completed',
  'log.ocr.supporting.start': 'Starting blue technical label OCR',
  'log.ocr.supporting.done': 'Blue technical OCR completed',
  'log.context.candidateToRecognized': 'Converting candidate events into recognized context',
  'log.context.imageToCandidates': 'Converting image observation into deterministic candidates',
  'log.context.noReview': 'No review provided; using deterministic context derived from candidates',
  'log.context.applyReview': 'Applying normalization review',
  'log.workflow.reassignments': 'Applied deterministic source_touch_point reassignments',
  'error.workflowIncomplete': 'Incomplete workflow. Failures: {failures}',
  'error.workflowNoDetails': 'Workflow failed without details.',
  'ocr.technicalUnavailable': 'Technical OCR was not available to classify events by color.',
  'ocr.technicalReviewNeeded': 'Classic OCR detected technical {color} text, but low confidence or ambiguous characters require visual review.',
  'ocr.technicalTrusted': 'Classic OCR detected technical {color} text with enough confidence; by the color rule, it is a {role} candidate.',
  'ocr.fragmentsRemoved': '{count} OCR fragment(s) were removed because they were contained in more complete labels of the same color.',
  'ocr.eventsCoverage': 'Events detected by OCR in this step cover red and blue technical labels; shapes, arrows and flow are handled by later geometric steps.',
  'ocr.redLowConfidence': 'OCR detected technical labels with low confidence or ambiguous characters; use the original image for review before treating them as definitive.',
  'ocr.blueLowConfidence': 'Blue OCR detected supporting labels with low confidence or ambiguous characters; review before treating them as definitive.',
  'ocr.flowLegendMissing': 'Classic OCR did not find an explicit flow legend; ordering will need to use geometry/arrows or visual review.',
  'ocr.preprocessedRed': 'Preprocessed image used by red OCR: {path}',
  'ocr.preprocessedBlue': 'Preprocessed image used by blue OCR: {path}',
  'ocr.reviewCrop': 'Expanded crop for OCR review {index}. Transcribe the technical label visually; do not use the OCR hypothesis as definitive.',
  'shape.componentReasoning': 'Connected non-white component without dominant red/blue label pixels or dark arrow pixels.',
  'shape.geometryAssumption': 'Geometric detection uses connected components from non-white regions; overlapping rectangles are merged before classification.',
  'shape.labelAssumption': 'Touch point text labels are extracted by OCR localized to each box crop when possible.',
  'shape.labelCropReasoning': 'Text label extracted by OCR localized to the box crop.',
  'shape.mergedReasoning': 'Merged with {id} due to geometric overlap.',
  'arrow.solidReasoning': 'Long dark segment detected by classic geometry; treated as a candidate solid arrow.',
  'arrow.dashedReasoning': 'Multiple small aligned dark segments were grouped as a candidate dashed arrow.',
  'arrow.none': 'No arrow was detected by classic geometry with minimum confidence.',
  'arrow.assumption': 'Arrows are heuristics based on dark segments; arrowheads and direction may require visual review.',
  'flow.legendHeaderReasoning': 'Flow legend header detected by general OCR; nearby items below were treated as narrative order.',
  'spatial.assumption': 'Deterministic spatial composition uses proximity between event bboxes and shape bboxes; relationships may need review when there is visual overlap.',
  'spatial.unlabeledShape': '{id} did not receive a reliable text label from OCR and was named by index.',
  'touchPoint.ocrCandidateReasoning': 'Touch point candidate created from reliable text OCR when box geometry is ambiguous.',
  'correlation.nearestBbox': 'Correlation created by shortest distance between the OCR event bbox and the candidate box bbox.',
  'flow.legendReasoning': 'Flow deterministically derived from the OCR legend; touch points were approximated by geometry.',
  'flow.detectedMainName': 'Detected Main Flow',
  'flow.detectedAlternateName': 'Detected Alternate Flow',
  'flow.spatialWithArrow': 'Flow ordered by event spatial position and annotated with the first detected arrow.',
  'flow.spatialNoArrow': 'Flow ordered by event spatial position; no reliable arrow was detected.',
  'semantic.deterministicClassification': 'Deterministic classification: technical {color} label detected by classic OCR.',
  'genai.reviewLowConfidence': 'Visually validate items with low confidence from deterministic steps.',
  'genai.complementMissing': 'Complete labels or structures that classic detectors did not find.',
  'genai.resolveAmbiguities': 'Resolve ambiguities in arrow direction, touch point name and spatial association when the heuristic is not enough.',
  'observation.deterministicAssumption': 'Observation generated deterministically before the observe-image prompt.',
  'observation.uncertainItems': 'Items {items} were treated as structural or ambiguous and not as events.',
  'observation.droppedTouchPoints': 'Touch points {items} were removed because they collided with outside event labels; only the event reading was kept.',
  'correlation.rebuilt': 'Correlation deterministically rebuilt from flowsDetected.orderedEventTitles and each event role.',
  'context.flowDerived': 'Flow derived from {name}.',
  'context.flowAssociated': 'Flow associated with {name}.',
  'context.flowFromObservation': 'Flow deterministically derived from the image observation.',
  'context.flowMain': 'Main flow identified by solid arrows.',
  'context.flowAlternate': 'Alternate flow identified by dashed arrows.',
  'context.flowVisual': 'Flow visually identified in the image.',
  'context.arrowSolid': 'Solid arrows observed.',
  'context.arrowDashed': 'Dashed arrows observed.',
  'context.arrowUnknown': 'Arrow style inconclusive.',
  'context.consolidatedFlow': 'Flow automatically consolidated from recognized events.',
  'workbook.mappingStage': 'stage = domain + subdomain derived from the main touch point and consolidated as a slug.',
  'workbook.mappingActor': 'actor was normalized to system when the image does not provide a reliable operational actor.',
  'workbook.mappingService': 'service = domain.subdomain, derived from the touch point and event context.',
  'workbook.mappingTags': 'tags follow the touch_point:<slug>,business_domain:<slug> pattern.'
};

const dictionaries: Record<SupportedLocale, Record<I18nKey, string>> = {
  'pt-BR': ptBR,
  en
};

let activeLocale: SupportedLocale = 'pt-BR';

export function setLocale(locale: SupportedLocale): void {
  activeLocale = locale;
}

export function getLocale(): SupportedLocale {
  return activeLocale;
}

export function normalizeLocale(value: string | undefined): SupportedLocale {
  if (!value || value.trim() === '') {
    return 'pt-BR';
  }

  const normalized = value.trim().replace('_', '-').toLowerCase();
  if (normalized === 'pt' || normalized === 'pt-br') {
    return 'pt-BR';
  }
  if (normalized === 'en' || normalized === 'en-us' || normalized === 'en-gb') {
    return 'en';
  }

  throw new Error(t('locale.invalid', { locale: value }));
}

export function t(key: I18nKey, values: I18nValues = {}, locale = activeLocale): string {
  const template = dictionaries[locale][key] ?? dictionaries['pt-BR'][key];
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined || value === null ? match : String(value);
  });
}

export function translateLogMessage(message: string, locale = activeLocale): string {
  if (locale === 'pt-BR') {
    return message;
  }

  const nodeStart = message.match(/^Iniciando nó (.+)$/);
  if (nodeStart) {
    return `Starting node ${nodeStart[1]}`;
  }

  const nodeSuccess = message.match(/^Nó (.+) concluído com sucesso$/);
  if (nodeSuccess) {
    return `Node ${nodeSuccess[1]} completed successfully`;
  }

  const nodeFailure = message.match(/^Falha no nó (.+)$/);
  if (nodeFailure) {
    return `Node ${nodeFailure[1]} failed`;
  }

  return enLogMessages[message] ?? message;
}

const enLogMessages: Record<string, string> = {
  'Avaliando nó inicial do workflow': 'Evaluating initial workflow node',
  'Avaliando transição após extração': 'Evaluating transition after extraction',
  'Avaliando transição após geração do workbook': 'Evaluating transition after workbook generation',
  'Avaliando transição após normalização': 'Evaluating transition after normalization',
  'Avaliando transição após observação da imagem': 'Evaluating transition after image observation',
  'Avaliando transição após step': 'Evaluating transition after step',
  'Carregando prompt': 'Loading prompt',
  'Carregando variáveis de ambiente': 'Loading environment variables',
  'Construindo cliente de modelo': 'Building model client',
  'Construindo grafo LangGraph do workflow de event storming': 'Building event storming LangGraph workflow',
  'Encerrando workflow em fail': 'Ending workflow in fail node',
  'Extração LLM gerou eventos fora de textsOutsideShapes; usando candidatos determinísticos da observação': 'LLM extraction generated events outside textsOutsideShapes; using deterministic candidates from the observation',
  'Falha na extração LLM; usando fallback determinístico baseado na observação': 'LLM extraction failed; using deterministic fallback based on the observation',
  'Falha na revisão LLM da normalização; usando baseline determinística': 'LLM normalization review failed; using deterministic baseline',
  'Falha no OCR azul; workflow continuará sem labels coadjuvantes determinísticas': 'Blue OCR failed; workflow will continue without deterministic supporting labels',
  'Falha no OCR técnico; workflow continuará apenas com observação multimodal': 'Technical OCR failed; workflow will continue with multimodal observation only',
  'Falhas encontradas na validação da observação': 'Failures found in observation validation',
  'Falhas encontradas na validação do contexto': 'Failures found in context validation',
  'Falhas encontradas na validação do workbook': 'Failures found in workbook validation',
  'Falhas encontradas na validação dos eventos candidatos': 'Failures found in candidate event validation',
  'Gerando workbook XLSX': 'Generating XLSX workbook',
  'LANGSMITH_API_KEY ausente; tracing do LangSmith permanecerá desabilitado': 'LANGSMITH_API_KEY missing; LangSmith tracing will remain disabled',
  'LangSmith configurado para tracing': 'LangSmith configured for tracing',
  'Lendo arquivo JSON': 'Reading JSON file',
  'Modelos resolvidos por agente': 'Models resolved by agent',
  'Normalizando candidateContext para stages por domain model': 'Normalizing candidateContext into domain model stages',
  'Normalizando contexto reconhecido': 'Normalizing recognized context',
  'Persistindo arquivo JSON': 'Persisting JSON file',
  'Persistindo arquivo texto': 'Persisting text file',
  'Resultado da validação do contexto': 'Context validation result',
  'Resultado da validação do workbook': 'Workbook validation result',
  'Validando contexto reconhecido': 'Validating recognized context',
  'Validando eventos candidatos': 'Validating candidate events',
  'Validando observação da imagem': 'Validating image observation',
  'Validando payload de workbook': 'Validating workbook payload',
  'Validação da normalização concluída sem erros': 'Normalization validation completed without errors',
  'Validação da normalização encontrou inconsistências': 'Normalization validation found inconsistencies',
  'Validação da observação concluída sem erros': 'Observation validation completed without errors',
  'Validação da observação encontrou inconsistências': 'Observation validation found inconsistencies',
  'Validação do workbook concluída sem erros': 'Workbook validation completed without errors',
  'Validação do workbook encontrou inconsistências': 'Workbook validation found inconsistencies',
  'Validação dos candidatos concluída sem erros': 'Candidate validation completed without errors',
  'Validação dos candidatos encontrou inconsistências': 'Candidate validation found inconsistencies',
  'Workbook XLSX persistido com sucesso': 'XLSX workbook persisted successfully',
  'Workflow finalizado com sucesso': 'Workflow completed successfully',
  'Arquivo .env não encontrado; seguindo com variáveis já carregadas': '.env file not found; continuing with already loaded variables',
  'Extraindo JSON da resposta do modelo': 'Extracting JSON from model response',
  'Garantindo diretório': 'Ensuring directory',
  'Imagem convertida para payload multimodal': 'Image converted to multimodal payload',
  'Linha ignorada durante carga do .env': 'Line ignored while loading .env',
  'Normalizando linha': 'Normalizing row',
  'Prompt renderizado': 'Prompt rendered',
  'Variável carregada do .env': 'Variable loaded from .env'
};
