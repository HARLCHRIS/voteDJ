import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';

/**
 * Marque ou démarque manuellement un DJ comme qualifié pour la suite (FR-6, FR-20).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    return guard.response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    performanceId?: string;
    isQualified?: boolean;
  };

  if (!body.performanceId || typeof body.isQualified !== 'boolean') {
    return NextResponse.json(
      { error: 'Paramètres de qualification invalides.' },
      { status: 400 }
    );
  }

  const { serviceClient, authUserId } = guard.context;

  const { error } = await serviceClient
    .from('performances')
    .update({ is_qualified: body.isQualified })
    .eq('id', body.performanceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await serviceClient.from('audit_logs').insert({
    actor_id: authUserId,
    action: body.isQualified ? 'dj_qualified' : 'dj_unqualified',
    entity: 'performances',
    entity_id: body.performanceId,
    metadata: { is_qualified: body.isQualified },
  });

  return NextResponse.json({ ok: true });
}

