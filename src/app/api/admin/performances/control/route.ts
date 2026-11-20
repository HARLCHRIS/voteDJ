import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';

/**
 * Régie live : ouvre ou clôture manuellement un passage (FR-18).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    return guard.response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    performanceId?: string;
    action?: 'open' | 'close';
  };

  if (!body.performanceId || (body.action !== 'open' && body.action !== 'close')) {
    return NextResponse.json(
      { error: 'Paramètres de régie invalides.' },
      { status: 400 }
    );
  }

  const rpcName =
    body.action === 'open' ? 'admin_open_performance' : 'admin_close_performance';

  const { error } = await guard.context.userClient.rpc(rpcName, {
    p_performance_id: body.performanceId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

