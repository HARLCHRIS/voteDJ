'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AsyncState, LiveStatusPayload } from '@/types';

const POLL_INTERVAL_MS = 3000;

/**
 * Hook public qui interroge l'endpoint `/api/live-status`
 * toutes les 3 secondes pour afficher le DJ actuellement sur scène (< 5 s).
 * Ignore toute réponse plus ancienne que celle déjà affichée.
 */
export function useLivePerformance(initialData?: LiveStatusPayload | null) {
  const [state, setState] = useState<AsyncState<LiveStatusPayload>>({
    status: initialData ? 'success' : 'loading',
    data: initialData ?? null,
    error: null,
  });

  const fetchLiveStatus = useCallback(async (silent = false) => {
    if (!silent) {
      setState((prev) => ({ ...prev, status: 'loading', error: null }));
    }

    try {
      const response = await fetch('/api/live-status', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Impossible de récupérer l’état du direct.');
      }

      const payload = (await response.json()) as LiveStatusPayload;
      setState((prev) => {
        const prevTs = prev.data?.updatedAt ? Date.parse(prev.data.updatedAt) : 0;
        const nextTs = payload.updatedAt ? Date.parse(payload.updatedAt) : 0;
        if (prev.data && prevTs > 0 && nextTs > 0 && nextTs < prevTs) {
          return prev;
        }
        return {
          status: 'success',
          data: payload,
          error: null,
        };
      });
    } catch (err) {
      setState((prev) => ({
        status: prev.data ? 'success' : 'error',
        data: prev.data,
        error:
          err instanceof Error
            ? err.message
            : 'Erreur réseau lors de la synchronisation du direct.',
      }));
    }
  }, []);

  useEffect(() => {
    if (!initialData) {
      void fetchLiveStatus(false);
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchLiveStatus(true);
      }
    }, POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchLiveStatus(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchLiveStatus, initialData]);

  return {
    ...state,
    refresh: () => fetchLiveStatus(false),
  };
}

