// Recomputes the shape fingerprint for every reference fixture. Pure Node, no build needed.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../fixtures/reference/', import.meta.url).pathname;

function fingerprint(body) {
  const paths = [];
  const walk = (value, path) => {
    if (Array.isArray(value)) {
      paths.push(`${path}:array`);
      for (const item of value) walk(item, `${path}[]`);
      return;
    }
    if (value !== null && typeof value === 'object') {
      paths.push(`${path}:object`);
      for (const key of Object.keys(value).sort()) walk(value[key], `${path}.${key}`);
      return;
    }
    paths.push(`${path}:${typeof value}`);
  };
  walk(body, '$');
  return `sha256:${createHash('sha256').update(paths.sort().join('\n')).digest('hex')}`;
}

for (const file of readdirSync(root).filter((name) => name.endsWith('.json'))) {
  const path = join(root, file);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    console.log(`skip ${file}: intentionally malformed`);
    continue;
  }
  if (file === 'upstream-changed.json') {
    console.log(`skip ${file}: fingerprint intentionally stale`);
    continue;
  }
  parsed.metadata.fingerprint = fingerprint(parsed.body);
  writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`);
  console.log(`updated ${file}`);
}
