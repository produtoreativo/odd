type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

export function stringifyYaml(value: YamlValue): string {
  return `${renderValue(value, 0).trimEnd()}\n`;
}

export function stringifyYamlDocuments(docs: YamlValue[]): string {
  return docs.map((doc) => `---\n${renderValue(doc, 0).trimEnd()}\n`).join('');
}

function renderValue(value: YamlValue, indent: number): string {
  if (value === null || value === undefined) return 'null\n';
  if (typeof value === 'string') return `${renderScalar(value)}\n`;
  if (typeof value === 'number' || typeof value === 'boolean') return `${String(value)}\n`;
  if (Array.isArray(value)) return renderArray(value, indent);
  return renderObject(value, indent);
}

function renderObject(value: { [key: string]: YamlValue }, indent: number): string {
  const entries = Object.entries(value).filter(([, val]) => val !== undefined);
  if (entries.length === 0) return '{}\n';

  const pad = ' '.repeat(indent);
  let output = '';
  for (const [key, val] of entries) {
    if (isInlineScalar(val)) {
      output += `${pad}${renderKey(key)}: ${renderInline(val)}\n`;
      continue;
    }
    if (Array.isArray(val)) {
      if (val.length === 0) {
        output += `${pad}${renderKey(key)}: []\n`;
        continue;
      }
      output += `${pad}${renderKey(key)}:\n${renderArray(val, indent + 2)}`;
      continue;
    }
    if (typeof val === 'object' && val !== null) {
      const entryCount = Object.keys(val).length;
      if (entryCount === 0) {
        output += `${pad}${renderKey(key)}: {}\n`;
        continue;
      }
      output += `${pad}${renderKey(key)}:\n${renderObject(val as Record<string, YamlValue>, indent + 2)}`;
      continue;
    }
  }
  return output;
}

function renderArray(value: YamlValue[], indent: number): string {
  const pad = ' '.repeat(indent);
  let output = '';
  for (const item of value) {
    if (isInlineScalar(item)) {
      output += `${pad}- ${renderInline(item)}\n`;
      continue;
    }
    if (Array.isArray(item)) {
      output += `${pad}-\n${renderArray(item, indent + 2)}`;
      continue;
    }
    if (typeof item === 'object' && item !== null) {
      const rendered = renderObject(item as Record<string, YamlValue>, indent + 2);
      const lines = rendered.split('\n');
      if (lines.length > 1) {
        const firstLine = lines[0].slice(indent + 2);
        const rest = lines.slice(1).join('\n');
        output += `${pad}- ${firstLine}\n${rest}`;
      } else {
        output += `${pad}- ${rendered.trimStart()}`;
      }
      continue;
    }
  }
  return output;
}

function isInlineScalar(value: YamlValue): boolean {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function renderInline(value: YamlValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return renderScalar(value);
  return String(value);
}

function renderKey(key: string): string {
  return /^[A-Za-z0-9_.-]+$/.test(key) ? key : JSON.stringify(key);
}

function renderScalar(value: string): string {
  if (value === '') return '""';
  if (/[\n"\\:#&*!|>'%@`{}\[\],?-]/.test(value) || /^\s|\s$/.test(value)) {
    return JSON.stringify(value);
  }
  if (/^(true|false|null|~|yes|no|on|off)$/i.test(value)) {
    return JSON.stringify(value);
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}
