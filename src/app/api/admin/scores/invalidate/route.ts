import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';

/**
 * Invalide une note suspecte avec motif obligatoire et recalcule les scores (FR-14, FR-20).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    return guard.response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    scoreId?: string;
    reason?: string;
  };

  if (!body.scoreId || !body.reason || body.reason.trim().length < 3) {
    return NextResponse.json(
      { error: 'Motif obligatoire (minimum 3 caractères).' },
      { status: 400 }
    );
  }

  const { error } = await guard.context.userClient.rpc(
    'admin_invalidate_score',
    {
      p_score_id: body.scoreId,
      p_reason: body.reason.trim(),
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

