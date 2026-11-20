import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import type { RoundStatus } from '@/types';

const ALLOWED_ROUND_STATUSES: readonly RoundStatus[] = [
  'draft',
  'scheduled',
  'live',
  'completed',
];

/**
 * Met à jour le statut et le nombre minimum de notes requises d'une prime (FR-17).
 */
export async function PATCH(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    return guard.response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    roundId?: string;
    status?: RoundStatus;
    minScoresRequired?: number;
  };

  if (
    !body.roundId ||
    !body.status ||
    !ALLOWED_ROUND_STATUSES.includes(body.status) ||
    typeof body.minScoresRequired !== 'number' ||
    body.minScoresRequired < 0
  ) {
    return NextResponse.json(
      { error: 'Paramètres de prime invalides.' },
      { status: 400 }
    );
  }

  const { serviceClient, authUserId } = guard.context;

  const { error } = await serviceClient
    .from('rounds')
    .update({
      status: body.status,
      min_scores_required: Math.floor(body.minScoresRequired),
    })
    .eq('id', body.roundId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await serviceClient.from('audit_logs').insert({
    actor_id: authUserId,
    action: 'round_updated',
    entity: 'rounds',
    entity_id: body.roundId,
    metadata: {
      status: body.status,
      min_scores_required: Math.floor(body.minScoresRequired),
    },
  });

  return NextResponse.json({ ok: true });
}

