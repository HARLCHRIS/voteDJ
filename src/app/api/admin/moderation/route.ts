import { NextResponse, type NextRequest } from 'next/server';
import type {
  AdminDeviceRecord,
  AdminModerationSnapshot,
  AdminScoreRecord,
} from '@/hooks/useAdminModeration';
import { requireAdminSession } from '@/lib/auth/admin-guard';

/**
 * Retourne la liste des appareils liés et les notes récentes pour la modération (FR-20).
 */
export async function GET() {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    return guard.response;
  }

  const { serviceClient } = guard.context;

  const [{ data: deviceRows }, { data: voterRows }, { data: scoreRows }, { data: perfRows }, { data: djRows }] =
    await Promise.all([
      serviceClient
        .from('devices')
        .select('id, voter_id, status, user_agent, first_seen_at, last_seen_at, unlinked_at')
        .order('last_seen_at', { ascending: false })
        .limit(100),
      serviceClient.from('voters').select('id, is_blocked'),
      serviceClient
        .from('public_scores')
        .select('id, performance_id, voter_id, device_id, score, is_valid, invalidated_reason, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
      serviceClient.from('performances').select('id, dj_id'),
      serviceClient.from('djs').select('id, stage_name'),
    ]);

  const voterBlockedMap = new Map(
    (voterRows ?? []).map((v) => [v.id, v.is_blocked])
  );
  const djMap = new Map((djRows ?? []).map((d) => [d.id, d.stage_name]));
  const perfDjMap = new Map(
    (perfRows ?? []).map((p) => [p.id, djMap.get(p.dj_id) ?? 'DJ'])
  );

  const scoresCountByDevice = new Map<string, number>();
  for (const s of scoreRows ?? []) {
    scoresCountByDevice.set(
      s.device_id,
      (scoresCountByDevice.get(s.device_id) ?? 0) + 1
    );
  }

  const devices: AdminDeviceRecord[] = (deviceRows ?? []).map((d) => ({
    id: d.id,
    voterId: d.voter_id,
    status: d.status,
    voterBlocked: voterBlockedMap.get(d.voter_id) ?? false,
    userAgent: d.user_agent,
    firstSeenAt: d.first_seen_at,
    lastSeenAt: d.last_seen_at,
    unlinkedAt: d.unlinked_at,
    scoresCount: scoresCountByDevice.get(d.id) ?? 0,
  }));

  const recentScores: AdminScoreRecord[] = (scoreRows ?? []).map((s) => ({
    id: s.id,
    performanceId: s.performance_id,
    djStageName: perfDjMap.get(s.performance_id) ?? 'DJ',
    voterId: s.voter_id,
    deviceId: s.device_id,
    score: s.score,
    isValid: s.is_valid,
    invalidatedReason: s.invalidated_reason,
    createdAt: s.created_at,
  }));

  return NextResponse.json({ devices, recentScores } satisfies AdminModerationSnapshot);
}

/**
 * Exécute une action de modération : déliaison d'appareil, blocage/déblocage appareil ou compte.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    return guard.response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?:
      | 'unlink_device'
      | 'block_device'
      | 'unblock_device'
      | 'block_voter'
      | 'unblock_voter';
    deviceId?: string;
    voterId?: string;
  };

  const { serviceClient, authUserId } = guard.context;

  if (body.action === 'unlink_device' && body.deviceId) {
    const { data: device } = await serviceClient
      .from('devices')
      .select('id, voter_id')
      .eq('id', body.deviceId)
      .single();

    if (!device) {
      return NextResponse.json({ error: 'Appareil introuvable.' }, { status: 404 });
    }

    await serviceClient
      .from('devices')
      .update({ unlinked_at: new Date().toISOString() })
      .eq('id', body.deviceId);

    await serviceClient.from('device_events').insert({
      device_id: device.id,
      voter_id: device.voter_id,
      event_type: 'unlinked_by_admin',
      metadata: { admin_auth_id: authUserId },
    });

    await serviceClient.from('audit_logs').insert({
      actor_id: authUserId,
      action: 'device_unlinked',
      entity: 'devices',
      entity_id: device.id,
      metadata: { voter_id: device.voter_id },
    });

    return NextResponse.json({
      ok: true,
      message: 'Appareil délié. Le votant peut associer un nouveau téléphone.',
    });
  }

  if (
    (body.action === 'block_device' || body.action === 'unblock_device') &&
    body.deviceId
  ) {
    const nextStatus = body.action === 'block_device' ? 'blocked' : 'active';
    const { data: device } = await serviceClient
      .from('devices')
      .update({ status: nextStatus })
      .eq('id', body.deviceId)
      .select('id, voter_id')
      .single();

    if (!device) {
      return NextResponse.json({ error: 'Appareil introuvable.' }, { status: 404 });
    }

    await serviceClient.from('device_events').insert({
      device_id: device.id,
      voter_id: device.voter_id,
      event_type: body.action === 'block_device' ? 'blocked' : 'unblocked',
      metadata: { admin_auth_id: authUserId },
    });

    await serviceClient.from('audit_logs').insert({
      actor_id: authUserId,
      action: body.action,
      entity: 'devices',
      entity_id: device.id,
      metadata: { status: nextStatus },
    });

    return NextResponse.json({
      ok: true,
      message:
        body.action === 'block_device'
          ? 'Appareil bloqué.'
          : 'Appareil débloqué.',
    });
  }

  if (
    (body.action === 'block_voter' || body.action === 'unblock_voter') &&
    body.voterId
  ) {
    const isBlocked = body.action === 'block_voter';
    const { error } = await serviceClient
      .from('voters')
      .update({ is_blocked: isBlocked })
      .eq('id', body.voterId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await serviceClient.from('audit_logs').insert({
      actor_id: authUserId,
      action: body.action,
      entity: 'voters',
      entity_id: body.voterId,
      metadata: { is_blocked: isBlocked },
    });

    return NextResponse.json({
      ok: true,
      message: isBlocked ? 'Compte votant bloqué.' : 'Compte votant débloqué.',
    });
  }

  return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
}

