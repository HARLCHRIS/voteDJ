import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';

/**
 * Met à jour l'ordre de passage des DJ au sein d'une prime (FR-17).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    return guard.response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    roundId?: string;
    orderedPerformanceIds?: string[];
  };

  if (
    !body.roundId ||
    !Array.isArray(body.orderedPerformanceIds) ||
    body.orderedPerformanceIds.length === 0
  ) {
    return NextResponse.json(
      { error: 'Liste ordonnée des passages requise.' },
      { status: 400 }
    );
  }

  const { serviceClient, authUserId } = guard.context;

  for (let idx = 0; idx < body.orderedPerformanceIds.length; idx += 1) {
    const perfId = body.orderedPerformanceIds[idx];
    if (!perfId) continue;

    await serviceClient
      .from('performances')
      .update({ performance_order: idx + 1 })
      .eq('id', perfId)
      .eq('round_id', body.roundId);
  }

  await serviceClient.from('audit_logs').insert({
    actor_id: authUserId,
    action: 'performances_reordered',
    entity: 'rounds',
    entity_id: body.roundId,
    metadata: { ordered_ids: body.orderedPerformanceIds },
  });

  return NextResponse.json({ ok: true });
}

