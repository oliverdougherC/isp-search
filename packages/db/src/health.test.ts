import { describe, expect, it } from 'vitest';

import { migrationsFolder, readMigrationJournal } from './migrations.js';

describe('migration journal', () => {
  it('is committed and parseable', () => {
    const journal = readMigrationJournal();
    expect(journal.dialect).toBe('postgresql');
    expect(journal.entries.length).toBeGreaterThanOrEqual(1);
    expect(migrationsFolder().endsWith('drizzle')).toBe(true);
  });
});
