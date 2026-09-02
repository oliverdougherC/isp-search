import { resolve } from 'node:path';

import { scanRepository } from './scanner.js';

const root = resolve(process.argv[2] ?? process.cwd());
const findings = scanRepository(root);
if (findings.length === 0) {
  process.stdout.write(`fixture scan: clean (${root})\n`);
  process.exitCode = 0;
} else {
  process.stdout.write(`fixture scan: ${String(findings.length)} finding(s)\n`);
  for (const finding of findings) {
    process.stdout.write(
      `  ${finding.file}:${String(finding.line)} [${finding.rule}] ${finding.excerpt}\n`,
    );
  }
  process.exitCode = 1;
}
