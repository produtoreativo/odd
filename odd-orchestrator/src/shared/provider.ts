export type ObservabilityProvider = 'datadog' | 'dynatrace' | 'grafana';

export function parseProvider(value: string | boolean | undefined): ObservabilityProvider {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'datadog';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'datadog' || normalized === 'dynatrace' || normalized === 'grafana') {
    return normalized;
  }

  throw new Error(`Provider inválido: ${value}. Valores suportados: datadog, dynatrace, grafana`);
}
