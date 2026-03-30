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
  return traceable(fn, {
    name: options.name,
    run_type: options.runType ?? 'chain',
    project_name: process.env.LANGSMITH_PROJECT,
    tags: ['event-storming-foss', ...(options.tags ?? [])],
    metadata: options.metadata
  });
}
