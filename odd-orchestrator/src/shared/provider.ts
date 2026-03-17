export type ObservabilityProvider = 'datadog' | 'dynatrace';

export function parseProvider(value: string | boolean | undefined): ObservabilityProvider {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'datadog';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'datadog' || normalized === 'dynatrace') {
    return normalized;
  }

  throw new Error(`Provider inválido: ${value}. Valores suportados: datadog, dynatrace`);
}
