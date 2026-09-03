// Creates a local .env from .env.example with a freshly generated ADDRESS_HMAC_SECRET.
// Pure Node; safe to run before `pnpm install`.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const target = resolve(root, '.env');
if (existsSync(target)) {
  console.log('.env already exists; leaving it untouched.');
  process.exit(0);
}
const template = readFileSync(resolve(root, '.env.example'), 'utf8');
const secret = randomBytes(32).toString('hex');
const rawKey = randomBytes(32).toString('hex');
const content = template
  .replace(/^ADDRESS_HMAC_SECRET=.*$/m, `ADDRESS_HMAC_SECRET=${secret}`)
  .replace(/^RAW_ADDRESS_ENCRYPTION_KEY=.*$/m, `RAW_ADDRESS_ENCRYPTION_KEY=${rawKey}`);
writeFileSync(target, content, { mode: 0o600 });
console.log(
  'Wrote .env with generated ADDRESS_HMAC_SECRET and RAW_ADDRESS_ENCRYPTION_KEY (mode 600).',
);
