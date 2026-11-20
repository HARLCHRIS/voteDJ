import Papa from 'papaparse';
import type { CsvDjRowError, PublicRoundSummary } from '@/types';

export interface ParsedDjCsvEntry {
  stageName: string;
  roundId: string;
  realName?: string;
  genre?: string;
  bio?: string;
}

export interface ParsedDjCsvResult {
  validEntries: ParsedDjCsvEntry[];
  errors: CsvDjRowError[];
  totalRows: number;
}

/**
 * Normalise un libellé de prime saisi dans un fichier CSV (ex: "prime 1", "1", "Prime 2")
 * vers l'identifiant exact d'une prime existante.
 */
function resolveRoundId(
  rawRound: string,
  rounds: PublicRoundSummary[]
): string | null {
  const normalized = rawRound.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const round of rounds) {
    if (
      round.name.toLowerCase() === normalized ||
      String(round.orderNumber) === normalized ||
      `p${round.orderNumber}` === normalized ||
      `prime${round.orderNumber}` === normalized
    ) {
      return round.id;
    }
  }

  return null;
}

/**
 * Parse et valide un fichier CSV d'import rapide des DJ (colonnes obligatoires : nom et prime).
 * Retourne les lignes valides prêtes à insérer et un rapport détaillé des lignes en erreur.
 */
export function parseDjCsvContent(
  csvText: string,
  rounds: PublicRoundSummary[]
): ParsedDjCsvResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const validEntries: ParsedDjCsvEntry[] = [];
  const errors: CsvDjRowError[] = [];

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2; // +1 en-tête, +1 index base 1
    const rawName = (
      row['nom'] ??
      row['nom_de_scene'] ??
      row['stage_name'] ??
      row['dj'] ??
      ''
    ).trim();
    const rawRound = (row['prime'] ?? row['round'] ?? '').trim();

    if (!rawName) {
      errors.push({
        rowNumber,
        rawName: rawName || '(vide)',
        rawRound: rawRound || '(vide)',
        reason: 'Nom de scène manquant.',
      });
      return;
    }

    const roundId = resolveRoundId(rawRound, rounds);
    if (!roundId) {
      errors.push({
        rowNumber,
        rawName,
        rawRound: rawRound || '(vide)',
        reason: `Prime inconnue ("${rawRound}"). Valeurs attendues : Prime 1 ou Prime 2.`,
      });
      return;
    }

    validEntries.push({
      stageName: rawName,
      roundId,
      realName: row['real_name']?.trim() || row['nom_reel']?.trim() || undefined,
      genre: row['genre']?.trim() || undefined,
      bio: row['bio']?.trim() || undefined,
    });
  });

  return {
    validEntries,
    errors,
    totalRows: parsed.data.length,
  };
}

