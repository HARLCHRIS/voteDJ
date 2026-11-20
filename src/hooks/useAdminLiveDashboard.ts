'use client';

import { useCallback, useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
  AdminDjFormInput,
  AdminPerformanceRankingRow,
  AsyncState,
  CsvDjImportReport,
  FraudAlertItem,
  PublicRoundSummary,
  RoundStatus,
} from '@/types';

export interface AdminDashboardSnapshot {
  rounds: PublicRoundSummary[];
  rankings: AdminPerformanceRankingRow[];
  fraudAlerts: FraudAlertItem[];
  totalValidScores: number;
  lastUpdatedAt: string;
}

/**
 * Hook administrateur complet : charge les primes, les DJ, les classements en direct,
 * les alertes anti-fraude et écoute Supabase Realtime (< 5 s de latence).
 */
export function useAdminLiveDashboard(isAdmin: boolean) {
  const [state, setState] = useState<AsyncState<AdminDashboardSnapshot>>({
    status: 'loading',
    data: null,
    error: null,
  });
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async (silent = false) => {
    if (!isAdmin) {
      return;
    }

    if (!silent) {
      setState((prev) => ({ ...prev, status: 'loading', error: null }));
    }

    try {
      const res = await fetch('/api/admin/dashboard', { cache: 'no-store' });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errBody.error || 'Accès au tableau de bord refusé.');
      }

      const payload = (await res.json()) as AdminDashboardSnapshot;
      setState({
        status: 'success',
        data: payload,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        status: 'error',
        data: prev.data,
        error:
          err instanceof Error
            ? err.message
            : 'Erreur lors du chargement du back-office.',
      }));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    void loadSnapshot(false);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel('admin-live-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'score_aggregates' },
        () => {
          void loadSnapshot(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'performances' },
        () => {
          void loadSnapshot(true);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'device_events' },
        () => {
          void loadSnapshot(true);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, loadSnapshot]);

  const runAdminAction = useCallback(
    async <TResponse,>(
      endpoint: string,
      method: 'POST' | 'PATCH',
      body: Record<string, unknown>,
      successMsg: string
    ): Promise<TResponse | null> => {
      setActionError(null);
      setActionMessage(null);

      try {
        const res = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = (await res.json()) as TResponse & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || 'Action administrateur refusée.');
        }

        setActionMessage(successMsg);
        await loadSnapshot(true);
        return data;
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : 'Erreur inattendue.'
        );
        return null;
      }
    },
    [loadSnapshot]
  );

  const createDj = useCallback(
    (input: AdminDjFormInput) =>
      runAdminAction(
        '/api/admin/djs',
        'POST',
        { ...input },
        `DJ "${input.stageName}" enregistré et ajouté à la prime.`
      ),
    [runAdminAction]
  );

  const updateDj = useCallback(
    (djId: string, input: AdminDjFormInput) =>
      runAdminAction(
        '/api/admin/djs',
        'PATCH',
        { djId, ...input },
        `Fiche DJ "${input.stageName}" mise à jour.`
      ),
    [runAdminAction]
  );

  const importDjsCsv = useCallback(
    (csvText: string) =>
      runAdminAction<CsvDjImportReport>(
        '/api/admin/djs/import',
        'POST',
        { csvText },
        'Import CSV traité.'
      ),
    [runAdminAction]
  );

  const controlPerformance = useCallback(
    (performanceId: string, action: 'open' | 'close') =>
      runAdminAction(
        '/api/admin/performances/control',
        'POST',
        { performanceId, action },
        action === 'open'
          ? 'Passage ouvert : le public peut maintenant noter ce DJ.'
          : 'Passage clôturé : les notes sont figées.'
      ),
    [runAdminAction]
  );

  const reorderPerformances = useCallback(
    (roundId: string, orderedPerformanceIds: string[]) =>
      runAdminAction(
        '/api/admin/performances/reorder',
        'POST',
        { roundId, orderedPerformanceIds },
        'Ordre de passage mis à jour.'
      ),
    [runAdminAction]
  );

  const toggleQualified = useCallback(
    (performanceId: string, isQualified: boolean) =>
      runAdminAction(
        '/api/admin/performances/qualify',
        'POST',
        { performanceId, isQualified },
        isQualified ? 'DJ marqué qualifié.' : 'Qualification retirée.'
      ),
    [runAdminAction]
  );

  const updateRoundConfig = useCallback(
    (roundId: string, status: RoundStatus, minScoresRequired: number) =>
      runAdminAction(
        '/api/admin/rounds',
        'PATCH',
        { roundId, status, minScoresRequired },
        'Configuration de la prime mise à jour.'
      ),
    [runAdminAction]
  );

  return {
    ...state,
    actionMessage,
    actionError,
    refresh: () => loadSnapshot(false),
    createDj,
    updateDj,
    importDjsCsv,
    controlPerformance,
    reorderPerformances,
    toggleQualified,
    updateRoundConfig,
  };
}

