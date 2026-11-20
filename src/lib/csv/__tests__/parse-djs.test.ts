import { describe, expect, it } from 'vitest';
import { parseDjCsvContent } from '@/lib/csv/parse-djs';
import type { PublicRoundSummary } from '@/types';

const ROUNDS: PublicRoundSummary[] = [
  {
    id: 'round-1',
    name: 'Prime 1',
    orderNumber: 1,
    status: 'scheduled',
    minScoresRequired: 5,
  },
  {
    id: 'round-2',
    name: 'Prime 2',
    orderNumber: 2,
    status: 'draft',
    minScoresRequired: 5,
  },
];

describe('parseDjCsvContent', () => {
  it('importe 25 DJ valides et signale une prime inconnue', () => {
    const validRows = Array.from({ length: 25 }, (_, i) => {
      const prime = i < 13 ? 'Prime 1' : 'Prime 2';
      return `DJ ${i + 1},${prime}`;
    });
    const csv = ['nom,prime', ...validRows, 'DJ Invalide,Prime 99'].join('\n');

    const result = parseDjCsvContent(csv, ROUNDS);

    expect(result.totalRows).toBe(26);
    expect(result.validEntries).toHaveLength(25);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.rawName).toBe('DJ Invalide');
    expect(result.errors[0]?.reason).toContain('Prime inconnue');
  });

  it('rejette une ligne sans nom de scène', () => {
    const csv = 'nom,prime\n,Prime 1';
    const result = parseDjCsvContent(csv, ROUNDS);

    expect(result.validEntries).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.reason).toContain('Nom de scène manquant');
  });
});

