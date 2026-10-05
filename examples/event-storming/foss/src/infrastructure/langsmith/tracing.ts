import { traceable } from 'langsmith/traceable';

type TraceOptions = {
  name: string;
  runType?: 'chain' | 'tool' | 'llm' | 'retriever' | 'parser' | 'embedding' | 'prompt';
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export function traceStep<Func extends (...args: any[]) => any>(
  fn: Func,
  options: TraceOptions
) {
  const serviceName = process.env.LANGSMITH_SERVICE_NAME ?? 'event-storming-foss-observe-split';

  return traceable(fn, {
    name: options.name,
    run_type: options.runType ?? 'chain',
    project_name: process.env.LANGSMITH_PROJECT,
    tags: [serviceName, ...(options.tags ?? [])],
    metadata: {
      serviceName,
      ...(options.metadata ?? {})
    }
  });
}
