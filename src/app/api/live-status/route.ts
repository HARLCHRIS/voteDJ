import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import type { LiveStatusPayload, PublicPerformanceItem, PublicRoundSummary } from '@/types';

export const revalidate = 3;

const DEMO_FALLBACK_PAYLOAD: LiveStatusPayload = {
  eventName: 'Eat & Drink Festival Cotonou 2027 – DJ Challenge',
  activeRound: {
    id: 'demo-prime-1',
    name: 'Prime 1',
    orderNumber: 1,
    status: 'scheduled',
    minScoresRequired: 5,
  },
  openPerformance: null,
  totalPerformancesInRound: 0,
  closedCountInRound: 0,
  updatedAt: new Date().toISOString(),
};

/**
 * Endpoint public léger et mis en cache (s-maxage=3) retournant l'état du direct
 * et le DJ actuellement sur scène sans exposer aucun résultat de notation.
 */
export async function GET() {
  const serviceClient = createSupabaseServiceClient();

  if (!serviceClient) {
    return NextResponse.json(DEMO_FALLBACK_PAYLOAD, {
      headers: {
        'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=2',
      },
    });
  }

  try {
    const { data: eventRow } = await serviceClient
      .from('events')
      .select('id, name')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: roundRows } = await serviceClient
      .from('rounds')
      .select('id, name, order_number, status, min_scores_required')
      .order('order_number', { ascending: true });

    const rounds = roundRows ?? [];
    const activeRoundRow =
      rounds.find((r) => r.status === 'live') ??
      rounds.find((r) => r.status === 'scheduled') ??
      rounds[0] ??
      null;

    const activeRound: PublicRoundSummary | null = activeRoundRow
      ? {
          id: activeRoundRow.id,
          name: activeRoundRow.name,
          orderNumber: activeRoundRow.order_number,
          status: activeRoundRow.status,
          minScoresRequired: activeRoundRow.min_scores_required,
        }
      : null;

    let openPerformance: PublicPerformanceItem | null = null;
    let nextPerformancePhotoUrl: string | null = null;
    let lastClosedPerformance: LiveStatusPayload['lastClosedPerformance'] = null;
    let totalPerformancesInRound = 0;
    let closedCountInRound = 0;

    if (activeRoundRow) {
      const { data: perfRows } = await serviceClient
        .from('performances')
        .select('id, round_id, dj_id, performance_order, status, opened_at, closed_at, is_qualified')
        .eq('round_id', activeRoundRow.id)
        .order('performance_order', { ascending: true });

      const roundPerfs = perfRows ?? [];
      totalPerformancesInRound = roundPerfs.length;
      closedCountInRound = roundPerfs.filter((p) => p.status === 'closed').length;

      const openPerf = roundPerfs.find((p) => p.status === 'open');
      const nextWaitingPerf = roundPerfs.find((p) => p.status === 'waiting');

      if (nextWaitingPerf) {
        const { data: nextDj } = await serviceClient
          .from('djs')
          .select('photo_url')
          .eq('id', nextWaitingPerf.dj_id)
          .maybeSingle();
        nextPerformancePhotoUrl = nextDj?.photo_url ?? null;
      }

      if (openPerf) {
        const { data: djRow } = await serviceClient
          .from('djs')
          .select('id, stage_name, real_name, bio, genre, photo_url, media_url, social_links')
          .eq('id', openPerf.dj_id)
          .maybeSingle();

        if (djRow) {
          openPerformance = {
            id: openPerf.id,
            roundId: openPerf.round_id,
            roundName: activeRoundRow.name,
            performanceOrder: openPerf.performance_order,
            status: openPerf.status,
            openedAt: openPerf.opened_at,
            closedAt: openPerf.closed_at,
            isQualified: openPerf.is_qualified,
            dj: {
              id: djRow.id,
              stageName: djRow.stage_name,
              realName: djRow.real_name,
              bio: djRow.bio,
              genre: djRow.genre,
              photoUrl: djRow.photo_url,
              mediaUrl: djRow.media_url,
              socialLinks: djRow.social_links ?? {},
            },
          };
        }
      } else if (closedCountInRound > 0) {
        const latestClosed = [...roundPerfs]
          .filter((p) => p.status === 'closed')
          .sort((a, b) =>
            (b.closed_at ?? '').localeCompare(a.closed_at ?? '')
          )[0];

        if (latestClosed) {
          const { data: closedDj } = await serviceClient
            .from('djs')
            .select('stage_name, photo_url')
            .eq('id', latestClosed.dj_id)
            .maybeSingle();
          if (closedDj) {
            lastClosedPerformance = {
              id: latestClosed.id,
              stageName: closedDj.stage_name,
              roundName: activeRoundRow.name,
              photoUrl: closedDj.photo_url,
              closedAt: latestClosed.closed_at,
            };
          }
        }
      }
    }

    const payload: LiveStatusPayload = {
      eventName:
        eventRow?.name ?? 'Eat & Drink Festival Cotonou 2027 – DJ Challenge',
      activeRound,
      openPerformance,
      nextPerformancePhotoUrl,
      lastClosedPerformance,
      totalPerformancesInRound,
      closedCountInRound,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=2',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Erreur lors de la lecture du statut en direct.' },
      { status: 500 }
    );
  }
}

