import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';

/**
 * Échappe une valeur de cellule CSV pour prévenir l'injection de formules et les guillemets.
 */
function csvCell(value: string | number | boolean | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Exporte les résultats du public ou le journal d'audit complet au format CSV UTF-8 (FR-20).
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    return guard.response;
  }

  const type = request.nextUrl.searchParams.get('type') || 'results';
  const { serviceClient } = guard.context;

  if (type === 'audit') {
    const { data: logs } = await serviceClient
      .from('audit_logs')
      .select('id, actor_id, action, entity, entity_id, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(2000);

    const lines = [
      ['id', 'date', 'actor_id', 'action', 'entity', 'entity_id', 'metadata']
        .map(csvCell)
        .join(','),
      ...(logs ?? []).map((log) =>
        [
          log.id,
          log.created_at,
          log.actor_id,
          log.action,
          log.entity,
          log.entity_id,
          JSON.stringify(log.metadata),
        ]
          .map(csvCell)
          .join(',')
      ),
    ];

    return new NextResponse(`\uFEFF${lines.join('\n')}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition':
          'attachment; filename="dj-challenge-audit-logs.csv"',
      },
    });
  }

  const [{ data: rounds }, { data: perfs }, { data: djs }, { data: aggs }] =
    await Promise.all([
      serviceClient.from('rounds').select('id, name, min_scores_required'),
      serviceClient
        .from('performances')
        .select('id, round_id, dj_id, performance_order, status, is_qualified')
        .order('performance_order', { ascending: true }),
      serviceClient.from('djs').select('id, stage_name, genre'),
      serviceClient
        .from('score_aggregates')
        .select('performance_id, scores_sum, scores_count'),
    ]);

  const roundMap = new Map((rounds ?? []).map((r) => [r.id, r]));
  const djMap = new Map((djs ?? []).map((d) => [d.id, d]));
  const aggMap = new Map((aggs ?? []).map((a) => [a.performance_id, a]));

  const lines = [
    [
      'Prime',
      'Ordre',
      'Nom de scene',
      'Genre',
      'Statut',
      'Notes valides',
      'Moyenne / 10',
      'Seuil atteint',
      'Qualifie',
    ]
      .map(csvCell)
      .join(','),
    ...(perfs ?? []).map((p) => {
      const round = roundMap.get(p.round_id);
      const dj = djMap.get(p.dj_id);
      const agg = aggMap.get(p.id);
      const count = agg?.scores_count ?? 0;
      const sum = agg?.scores_sum ?? 0;
      const avg = count > 0 ? (sum / count).toFixed(2) : '0.00';
      const minReq = round?.min_scores_required ?? 5;

      return [
        round?.name ?? '',
        p.performance_order,
        dj?.stage_name ?? '',
        dj?.genre ?? '',
        p.status,
        count,
        avg,
        count >= minReq ? 'Oui' : 'Non',
        p.is_qualified ? 'Oui' : 'Non',
      ]
        .map(csvCell)
        .join(',');
    }),
  ];

  return new NextResponse(`\uFEFF${lines.join('\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        'attachment; filename="dj-challenge-resultats-public.csv"',
    },
  });
}

