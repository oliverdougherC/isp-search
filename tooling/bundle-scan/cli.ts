import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Client bundle canary scan. Run after `next build` with canary values in the server-only
 * environment variables; if any canary appears in `.next/static` the server/browser boundary
 * has been broken.
 *
 *   node dist/bundle-scan/cli.js <path-to-.next> CANARY1 CANARY2 ...
 */
const [nextDirArg, ...canaries] = process.argv.slice(2);
if (!nextDirArg || canaries.length === 0) {
  process.stderr.write('usage: bundle-scan <.next dir> <canary> [canary...]\n');
  process.exit(2);
}
const staticDir = resolve(nextDirArg, 'static');
const files: string[] = [];
const walk = (dir: string): void => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else files.push(full);
  }
};
walk(staticDir);

let hits = 0;
for (const file of files) {
  const text = readFileSync(file, 'latin1');
  for (const canary of canaries) {
    if (text.includes(canary)) {
      hits += 1;
      process.stdout.write(
        `bundle scan: canary #${String(canaries.indexOf(canary) + 1)} found in ${relative(nextDirArg, file)}\n`,
      );
    }
  }
}
process.stdout.write(
  `bundle scan: scanned ${String(files.length)} client files, ${String(hits)} hit(s)\n`,
);
process.exitCode = hits === 0 ? 0 : 1;
