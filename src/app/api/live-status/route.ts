import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import type { LiveStatusPayload, PublicPerformanceItem, PublicRoundSummary } from '@/types';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=0, s-maxage=2, must-revalidate',
};

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
 * Endpoint public dynamique mis en cache CDN très court (s-maxage=2, sans stale)
 * retournant le DJ actuellement sur scène sans exposer aucun score.
 */
export async function GET() {
  const serviceClient = createSupabaseServiceClient();

  if (!serviceClient) {
    return NextResponse.json(DEMO_FALLBACK_PAYLOAD, {
      headers: CACHE_HEADERS,
    });
  }

  try {
    const { data: eventRow } = await serviceClient
      .from('events')
      .select('id, name')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const roundsQuery = serviceClient
      .from('rounds')
      .select('id, name, order_number, status, min_scores_required')
      .order('order_number', { ascending: true });

    const { data: roundRows } = eventRow
      ? await roundsQuery.eq('event_id', eventRow.id)
      : await roundsQuery;

    const rounds = roundRows ?? [];
    const activeRoundRow =
      rounds.find((r) => r.status === 'live') ??
      rounds.find((r) => r.status === 'scheduled') ??
      [...rounds].reverse().find((r) => r.status === 'completed') ??
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
          .sort((a, b) => {
            const aTime = a.closed_at ? Date.parse(a.closed_at) : Number.NEGATIVE_INFINITY;
            const bTime = b.closed_at ? Date.parse(b.closed_at) : Number.NEGATIVE_INFINITY;
            const safeATime = Number.isNaN(aTime) ? Number.NEGATIVE_INFINITY : aTime;
            const safeBTime = Number.isNaN(bTime) ? Number.NEGATIVE_INFINITY : bTime;
            if (safeBTime !== safeATime) {
              return safeBTime - safeATime;
            }
            return b.performance_order - a.performance_order;
          })[0];

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
              performanceOrder: latestClosed.performance_order,
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
      headers: CACHE_HEADERS,
    });
  } catch {
    return NextResponse.json(
      { error: 'Erreur lors de la lecture du statut en direct.' },
      { status: 500 }
    );
  }
}

