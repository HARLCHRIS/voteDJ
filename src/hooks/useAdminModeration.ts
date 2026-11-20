'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AsyncState } from '@/types';

export interface AdminDeviceRecord {
  id: string;
  voterId: string;
  status: 'active' | 'flagged' | 'blocked';
  voterBlocked: boolean;
  userAgent: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  unlinkedAt: string | null;
  scoresCount: number;
}

export interface AdminScoreRecord {
  id: string;
  performanceId: string;
  djStageName: string;
  voterId: string;
  deviceId: string;
  score: number;
  isValid: boolean;
  invalidatedReason: string | null;
  createdAt: string;
}

export interface AdminModerationSnapshot {
  devices: AdminDeviceRecord[];
  recentScores: AdminScoreRecord[];
}

/**
 * Hook administrateur dédié à la modération anti-fraude :
 * déliaison d'appareil, blocage/déblocage et invalidation motivée de notes.
 */
export function useAdminModeration(enabled: boolean) {
  const [state, setState] = useState<AsyncState<AdminModerationSnapshot>>({
    status: 'loading',
    data: null,
    error: null,
  });
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadModerationData = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setState((prev) => ({ ...prev, status: 'loading', error: null }));
    try {
      const res = await fetch('/api/admin/moderation', { cache: 'no-store' });
      const data = (await res.json()) as AdminModerationSnapshot & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Chargement impossible.');
      }
      setState({ status: 'success', data, error: null });
    } catch (err) {
      setState((prev) => ({
        status: 'error',
        data: prev.data,
        error:
          err instanceof Error
            ? err.message
            : 'Erreur lors du chargement de la modération.',
      }));
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      void loadModerationData();
    }
  }, [enabled, loadModerationData]);

  const invalidateScore = useCallback(
    async (scoreId: string, reason: string) => {
      setFeedback(null);
      const res = await fetch('/api/admin/scores/invalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoreId, reason }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Impossible d’invalider cette note.');
      }
      setFeedback('Note invalidée et classement recalculé.');
      await loadModerationData();
    },
    [loadModerationData]
  );

  const manageDeviceOrVoter = useCallback(
    async (payload: {
      action: 'unlink_device' | 'block_device' | 'unblock_device' | 'block_voter' | 'unblock_voter';
      deviceId?: string;
      voterId?: string;
    }) => {
      setFeedback(null);
      const res = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Action de modération impossible.');
      }
      setFeedback(data.message || 'Action appliquée.');
      await loadModerationData();
    },
    [loadModerationData]
  );

  return {
    ...state,
    feedback,
    refresh: loadModerationData,
    invalidateScore,
    manageDeviceOrVoter,
  };
}

