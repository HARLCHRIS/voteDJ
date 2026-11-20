'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collectLightweightFingerprint,
  getOrCreateClientDeviceToken,
} from '@/lib/security/device-client';
import type { AllowedScore, AsyncState, VoterScoreReceipt } from '@/types';

/**
 * Hook de soumission atomique et définitive de note (2, 4, 6, 8, 10) pour le passage en cours.
 * Récupère une éventuelle note déjà enregistrée au rechargement et empêche toute modification ultérieure.
 */
export function useSubmitScore(
  performanceId: string | null,
  isAuthenticatedVoter = false
) {
  const [scoresByPerformance, setScoresByPerformance] = useState<
    Record<string, AllowedScore>
  >({});
  const scoresRef = useRef<Record<string, AllowedScore>>({});
  const confirmedScoresRef = useRef<Record<string, AllowedScore>>({});
  const inFlightPerfRef = useRef<Record<string, boolean>>({});
  const isAuthenticatedRef = useRef(isAuthenticatedVoter);
  isAuthenticatedRef.current = isAuthenticatedVoter;

  const [state, setState] = useState<AsyncState<VoterScoreReceipt>>({
    status: 'idle',
    data: null,
    error: null,
  });

  const updateScoreState = useCallback(
    (perfId: string, nextScore: AllowedScore | undefined) => {
      if (nextScore !== undefined) {
        scoresRef.current[perfId] = nextScore;
      } else {
        delete scoresRef.current[perfId];
      }

      setScoresByPerformance((prev) => {
        if (nextScore !== undefined) {
          if (prev[perfId] === nextScore) {
            return prev;
          }
          return { ...prev, [perfId]: nextScore };
        }
        if (!(perfId in prev)) {
          return prev;
        }
        const copy = { ...prev };
        delete copy[perfId];
        return copy;
      });
    },
    []
  );

  const restoreOrClearScore = useCallback(
    (perfId: string) => {
      const confirmedScore = confirmedScoresRef.current[perfId];
      updateScoreState(perfId, confirmedScore);
    },
    [updateScoreState]
  );

  useEffect(() => {
    setState({
      status: 'idle',
      data: null,
      error: null,
    });

    if (!isAuthenticatedVoter) {
      scoresRef.current = {};
      confirmedScoresRef.current = {};
      inFlightPerfRef.current = {};
      setScoresByPerformance({});
      return;
    }

    if (!performanceId) {
      return;
    }

    let cancelled = false;
    void fetch(
      `/api/scores/my-vote?performanceId=${encodeURIComponent(performanceId)}`,
      { cache: 'no-store' }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { score?: AllowedScore | null } | null) => {
        if (cancelled || !payload?.score) {
          return;
        }
        const savedScore = payload.score;
        confirmedScoresRef.current[performanceId] = savedScore;
        updateScoreState(performanceId, savedScore);
      })
      .catch(() => {
        // Silencieux : la soumission serveur reste protégée en 409
      });

    return () => {
      cancelled = true;
    };
  }, [performanceId, isAuthenticatedVoter, updateScoreState]);

  const currentScore: AllowedScore | null = performanceId
    ? (scoresByPerformance[performanceId] ?? null)
    : null;

  /**
   * Envoie la note sélectionnée vers `/api/scores/submit` (verrouillée après validation).
   */
  const submitScore = useCallback(
    async (score: AllowedScore) => {
      const targetPerfId = performanceId;
      if (
        !targetPerfId ||
        inFlightPerfRef.current[targetPerfId] ||
        scoresRef.current[targetPerfId] !== undefined
      ) {
        return;
      }

      inFlightPerfRef.current[targetPerfId] = true;
      updateScoreState(targetPerfId, score);
      setState({ status: 'loading', data: null, error: null });

      try {
        const deviceToken = getOrCreateClientDeviceToken();
        const fingerprint = collectLightweightFingerprint();

        const res = await fetch('/api/scores/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            performanceId: targetPerfId,
            score,
            deviceToken,
            fingerprint,
          }),
        });

        const payload = (await res.json()) as VoterScoreReceipt & {
          error?: string;
          existingScore?: AllowedScore;
        };

        if (!isAuthenticatedRef.current) {
          return;
        }

        if (!res.ok) {
          if (res.status === 409 && payload.existingScore !== undefined) {
            const lockedScore = payload.existingScore;
            confirmedScoresRef.current[targetPerfId] = lockedScore;
            updateScoreState(targetPerfId, lockedScore);
            setState({
              status: 'success',
              data: null,
              error: null,
            });
            return;
          }

          restoreOrClearScore(targetPerfId);
          setState({
            status: 'error',
            data: null,
            error: payload.error || 'Impossible d’enregistrer votre note.',
          });
          return;
        }

        confirmedScoresRef.current[targetPerfId] = payload.score;
        updateScoreState(targetPerfId, payload.score);
        setState({
          status: 'success',
          data: payload,
          error: null,
        });
      } catch (err) {
        if (!isAuthenticatedRef.current) {
          return;
        }
        restoreOrClearScore(targetPerfId);
        setState({
          status: 'error',
          data: null,
          error:
            err instanceof Error
              ? err.message
              : 'Erreur réseau lors de l’envoi de votre note.',
        });
      } finally {
        delete inFlightPerfRef.current[targetPerfId];
      }
    },
    [performanceId, restoreOrClearScore, updateScoreState]
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
