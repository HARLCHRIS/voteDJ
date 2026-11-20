import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { parseDjCsvContent } from '@/lib/csv/parse-djs';
import type { CsvDjImportReport, PublicRoundSummary } from '@/types';

/**
 * Import CSV en masse de DJ (colonnes obligatoires : nom et prime) avec rapport
 * détaillé des lignes en erreur (FR-15).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    return guard.response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    csvText?: string;
  };
  if (!body.csvText || !body.csvText.trim()) {
    return NextResponse.json(
      { error: 'Le contenu CSV est vide.' },
      { status: 400 }
    );
  }

  const { data: roundRows, error: roundError } = await guard.context.serviceClient
    .from('rounds')
    .select('id, name, order_number, status, min_scores_required');

  if (roundError || !roundRows) {
    return NextResponse.json(
      { error: 'Impossible de charger les primes.' },
      { status: 500 }
    );
  }

  const rounds: PublicRoundSummary[] = roundRows.map((r) => ({
    id: r.id,
    name: r.name,
    orderNumber: r.order_number,
    status: r.status,
    minScoresRequired: r.min_scores_required,
  }));

  const parsed = parseDjCsvContent(body.csvText, rounds);
  let importedCount = 0;

  for (const entry of parsed.validEntries) {
    const { error } = await guard.context.userClient.rpc('admin_create_dj', {
      p_stage_name: entry.stageName,
      p_round_id: entry.roundId,
      p_real_name: entry.realName ?? null,
      p_bio: entry.bio ?? null,
      p_genre: entry.genre ?? null,
    });

    if (error) {
      parsed.errors.push({
        rowNumber: 0,
        rawName: entry.stageName,
        rawRound: entry.roundId,
        reason: error.message,
      });
    } else {
      importedCount += 1;
    }
  }

  const report: CsvDjImportReport = {
    totalRows: parsed.totalRows,
    importedCount,
    errors: parsed.errors,
  };

  return NextResponse.json(report);
}

