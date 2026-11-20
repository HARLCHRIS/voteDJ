import { NextResponse } from 'next/server';
import type { AdminDashboardSnapshot } from '@/hooks/useAdminLiveDashboard';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import type {
  AdminPerformanceRankingRow,
  FraudAlertItem,
  PublicRoundSummary,
} from '@/types';

/**
 * Calcule les rangs par prime en respectant `minScoresRequired`
 * et en attribuant le même rang aux égalités (sans départage).
 */
function assignRanksPerRound(
  rows: AdminPerformanceRankingRow[]
): AdminPerformanceRankingRow[] {
  const byRound = new Map<string, AdminPerformanceRankingRow[]>();

  for (const row of rows) {
    const list = byRound.get(row.roundId) ?? [];
    list.push(row);
    byRound.set(row.roundId, list);
  }

  for (const list of byRound.values()) {
    const eligible = list
      .filter((r) => r.meetsMinThreshold && r.scoresCount > 0)
      .sort((a, b) => b.publicAvg - a.publicAvg);

    let currentRank = 0;
    let lastAvg: number | null = null;
    eligible.forEach((item, index) => {
      if (lastAvg === null || item.publicAvg !== lastAvg) {
        currentRank = index + 1;
        lastAvg = item.publicAvg;
      }
      item.publicRank = currentRank;
    });
  }

  return rows;
}

/**
 * Retourne le snapshot temps réel du back-office : primes, classements calculés,
 * totaux agrégés et alertes anti-fraude (rafales de 10/2, multi-comptes IP, conflits).
 */
export async function GET() {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    return guard.response;
  }

  const { serviceClient } = guard.context;

  try {
    const [
      { data: roundRows },
      { data: perfRows },
      { data: djRows },
      { data: aggRows },
      { data: deviceEventRows },
      { data: recentValidScores },
    ] = await Promise.all([
      serviceClient
        .from('rounds')
        .select('id, name, order_number, status, min_scores_required')
        .order('order_number', { ascending: true }),
      serviceClient
        .from('performances')
        .select('id, round_id, dj_id, performance_order, status, is_qualified')
        .order('performance_order', { ascending: true }),
      serviceClient
        .from('djs')
        .select('id, stage_name, genre, photo_url'),
      serviceClient
        .from('score_aggregates')
        .select('performance_id, scores_sum, scores_count'),
      serviceClient
        .from('device_events')
        .select('id, device_id, voter_id, event_type, created_at')
        .in('event_type', [
          'refused_second_account',
          'refused_other_device',
          'flagged',
        ])
        .order('created_at', { ascending: false })
        .limit(20),
      serviceClient
        .from('public_scores')
        .select('performance_id, score, created_at')
        .eq('is_valid', true)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(500),
    ]);

    const rounds: PublicRoundSummary[] = (roundRows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      orderNumber: r.order_number,
      status: r.status,
      minScoresRequired: r.min_scores_required,
    }));

    const roundMap = new Map(rounds.map((r) => [r.id, r]));
    const djMap = new Map((djRows ?? []).map((d) => [d.id, d]));
    const aggMap = new Map(
      (aggRows ?? []).map((a) => [a.performance_id, a])
    );

    let totalValidScores = 0;

    const rankings: AdminPerformanceRankingRow[] = (perfRows ?? []).map((p) => {
      const round = roundMap.get(p.round_id);
      const dj = djMap.get(p.dj_id);
      const agg = aggMap.get(p.id);

      const scoresCount = agg?.scores_count ?? 0;
      const scoresSum = agg?.scores_sum ?? 0;
      const minRequired = round?.minScoresRequired ?? 5;
      totalValidScores += scoresCount;

      const publicAvg =
        scoresCount > 0
          ? Math.round((scoresSum / scoresCount) * 100) / 100
          : 0;

      return {
        performanceId: p.id,
        roundId: p.round_id,
        roundName: round?.name ?? 'Prime 1',
        performanceOrder: p.performance_order,
        status: p.status,
        isQualified: p.is_qualified,
        djId: p.dj_id,
        stageName: dj?.stage_name ?? 'DJ',
        genre: dj?.genre ?? null,
        photoUrl: dj?.photo_url ?? null,
        scoresCount,
        scoresSum,
        publicAvg,
        publicRank: null,
        meetsMinThreshold: scoresCount >= minRequired,
        minScoresRequired: minRequired,
      };
    });

    assignRanksPerRound(rankings);

    const fraudAlerts: FraudAlertItem[] = [];

    // 1. Alertes issues des événements d'appareil
    for (const ev of deviceEventRows ?? []) {
      fraudAlerts.push({
        id: `ev-${ev.id}`,
        type:
          ev.event_type === 'flagged' ? 'multi_account_ip' : 'device_conflict',
        severity: ev.event_type === 'flagged' ? 'high' : 'medium',
        title:
          ev.event_type === 'refused_second_account'
            ? 'Tentative de 2e compte sur même appareil'
            : ev.event_type === 'refused_other_device'
              ? 'Tentative depuis un autre téléphone'
              : 'Création en rafale depuis une même IP',
        description: `Événement "${ev.event_type}" enregistré.`,
        performanceId: null,
        deviceId: ev.device_id,
        voterId: ev.voter_id,
        createdAt: ev.created_at,
      });
    }

    // 2. Détection de rafales de 10 ou de 2 sur les 5 dernières minutes (FR-13)
    const burstMap = new Map<string, { tens: number; twos: number }>();
    for (const s of recentValidScores ?? []) {
      const entry = burstMap.get(s.performance_id) ?? { tens: 0, twos: 0 };
      if (s.score === 10) entry.tens += 1;
      if (s.score === 2) entry.twos += 1;
      burstMap.set(s.performance_id, entry);
    }

    for (const [perfId, counts] of burstMap.entries()) {
      const row = rankings.find((r) => r.performanceId === perfId);
      const label = row?.stageName ?? perfId;
      if (counts.tens >= 20) {
        fraudAlerts.unshift({
          id: `burst-10-${perfId}`,
          type: 'burst_score',
          severity: 'high',
          title: `Rafale de notes 10 sur ${label}`,
          description: `${counts.tens} notes maximales (10) reçues en moins de 5 minutes.`,
          performanceId: perfId,
          deviceId: null,
          voterId: null,
          createdAt: new Date().toISOString(),
        });
      }
      if (counts.twos >= 15) {
        fraudAlerts.unshift({
          id: `burst-2-${perfId}`,
          type: 'burst_score',
          severity: 'high',
          title: `Rafale de notes 2 sur ${label}`,
          description: `${counts.twos} notes minimales (2) reçues en moins de 5 minutes.`,
          performanceId: perfId,
          deviceId: null,
          voterId: null,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const snapshot: AdminDashboardSnapshot = {
      rounds,
      rankings,
      fraudAlerts: fraudAlerts.slice(0, 25),
      totalValidScores,
      lastUpdatedAt: new Date().toISOString(),
    };

    return NextResponse.json(snapshot);
  } catch {
    return NextResponse.json(
      { error: 'Erreur lors du calcul du tableau de bord.' },
      { status: 500 }
    );
  }
}


