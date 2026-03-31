function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mergeTerraformJson(...parts: Array<Record<string, unknown> | null | undefined>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const part of parts) {
    if (!part) {
      continue;
    }

    mergeInto(result, part);
  }

  return result;
}

function mergeInto(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];

    if (isPlainObject(existing) && isPlainObject(value)) {
      mergeInto(existing, value);
      continue;
    }

    target[key] = value;
  }
}
