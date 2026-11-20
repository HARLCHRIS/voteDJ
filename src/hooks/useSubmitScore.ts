'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  collectLightweightFingerprint,
  getOrCreateClientDeviceToken,
} from '@/lib/security/device-client';
import type { AllowedScore, AsyncState, VoterScoreReceipt } from '@/types';

/**
 * Hook de soumission atomique de note (2, 4, 6, 8, 10) pour le passage en cours.
 * Gère les notes par `performanceId` et les 3 états : loading / success / error.
 */
export function useSubmitScore(performanceId: string | null) {
  const [scoresByPerformance, setScoresByPerformance] = useState<
    Record<string, AllowedScore>
  >({});
  const [state, setState] = useState<AsyncState<VoterScoreReceipt>>({
    status: 'idle',
    data: null,
    error: null,
  });

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      status: 'idle',
      error: null,
    }));
  }, [performanceId]);

  const currentScore: AllowedScore | null = performanceId
    ? (scoresByPerformance[performanceId] ?? null)
    : null;

  /**
   * Envoie la note sélectionnée vers `/api/scores/submit`.
   */
  const submitScore = useCallback(
    async (score: AllowedScore) => {
      if (!performanceId) {
        return;
      }

      const previousScore = scoresByPerformance[performanceId];
      setScoresByPerformance((prev) => ({
        ...prev,
        [performanceId]: score,
      }));
      setState({ status: 'loading', data: null, error: null });

      try {
        const deviceToken = getOrCreateClientDeviceToken();
        const fingerprint = collectLightweightFingerprint();

        const res = await fetch('/api/scores/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            performanceId,
            score,
            deviceToken,
            fingerprint,
          }),
        });

        const payload = (await res.json()) as VoterScoreReceipt & {
          error?: string;
        };

        if (!res.ok) {
          setScoresByPerformance((prev) => {
            const copy = { ...prev };
            if (previousScore !== undefined) {
              copy[performanceId] = previousScore;
            } else {
              delete copy[performanceId];
            }
            return copy;
          });
          setState({
            status: 'error',
            data: null,
            error: payload.error || 'Impossible d’enregistrer votre note.',
          });
          return;
        }

        setState({
          status: 'success',
          data: payload,
          error: null,
        });
      } catch (err) {
        setScoresByPerformance((prev) => {
          const copy = { ...prev };
          if (previousScore !== undefined) {
            copy[performanceId] = previousScore;
          } else {
            delete copy[performanceId];
          }
          return copy;
        });
        setState({
          status: 'error',
          data: null,
          error:
            err instanceof Error
              ? err.message
              : 'Erreur réseau lors de l’envoi de votre note.',
        });
      }
    },
    [performanceId, scoresByPerformance]
  );

  /**
   * Réinitialise l'état d'erreur de soumission pour permettre une nouvelle tentative.
   */
  const clearError = useCallback(() => {
    setState((prev) =>
      prev.status === 'error'
        ? { ...prev, status: 'idle', error: null }
        : prev
    );
  }, []);

  return {
    currentScore,
    status: state.status,
    receipt: state.data,
    error: state.error,
    submitScore,
    clearError,
  };
}

