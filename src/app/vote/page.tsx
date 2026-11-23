'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  VotePosterScreen,
  type VotePosterDjView,
  type VoteUiPhase,
} from '@/components/vote/VotePosterScreen';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useDeviceBinding } from '@/hooks/useDeviceBinding';
import { useLivePerformance } from '@/hooks/useLivePerformance';
import { useSubmitScore } from '@/hooks/useSubmitScore';
import { useTurnstileToken } from '@/hooks/useTurnstileToken';
import { isSupabaseConfigured } from '@/lib/utils';
import type { AllowedScore } from '@/types';

const TEST_DJS: Record<string, VotePosterDjView> = {
  '1': {
    id: 'test-dj-1',
    stageName: 'DJ KEROZEN',
    roundName: 'Prime 1',
    performanceOrder: 1,
    photoUrl: null,
  },
  '2': {
    id: 'test-dj-2',
    stageName: 'DJ NOVA',
    roundName: 'Prime 1',
    performanceOrder: 2,
    photoUrl: null,
  },
  '3': {
    id: 'test-dj-3',
    stageName: 'DJ TEMPO',
    roundName: 'Prime 2',
    performanceOrder: 3,
    photoUrl: null,
  },
  none: {
    id: 'test-dj-none',
    stageName: 'DJ MYSTÈRE',
    roundName: 'Prime 1',
    performanceOrder: 4,
    photoUrl: null,
  },
};

/**
 * Contenu principal de la page de notation publique `/vote`.
 * Conserve toute la logique existante (polling 4 s, OAuth Google, liaison appareil,
 * envoi `/api/scores/submit`) dans l'interface plein écran inspirée de l'affiche VOTE.
 */
function VotePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const previewMode = searchParams.get('preview');
  const previewDjKey = searchParams.get('dj') || '1';
  const previewScoreParam = Number(searchParams.get('score') || '8');
  const oauthErrorParam =
    searchParams.get('auth_error') ||
    searchParams.get('error_code') ||
    searchParams.get('error');

  const allowPreview =
    Boolean(previewMode) &&
    (!isSupabaseConfigured() || process.env.NODE_ENV !== 'production');

  const auth = useAuthSession();
  const isVoter = auth.isAuthenticated && auth.role === 'voter';
  const isActiveVoter = isVoter && !allowPreview;

  const turnstile = useTurnstileToken({ active: isActiveVoter });

  const { inAppBrowser, bindingState, rebindDevice, retryBinding } =
    useDeviceBinding({
      isAuthenticatedVoter: isActiveVoter,
      userId: auth.userId,
      turnstileEnabled: turnstile.enabled,
      turnstileToken: turnstile.token,
      turnstileStatus: turnstile.status,
      turnstileError: turnstile.error,
    });

  const live = useLivePerformance();
  const openPerformance = live.data?.openPerformance ?? null;
  const hasServerEmptyState = Boolean(
    live.data && !live.data.openPerformance && !live.data.lastClosedPerformance
  );
  const scoring = useSubmitScore(openPerformance?.id ?? null, isActiveVoter);

  const [isOnline, setIsOnline] = useState(true);
  const [recentClosedDj, setRecentClosedDj] =
    useState<VotePosterDjView | null>(null);
  const prevOpenRef = useRef<VotePosterDjView | null>(null);

  // État local pour le mode aperçu sans Supabase configuré
  const [demoScore, setDemoScore] = useState<AllowedScore | null>(
    previewMode === 'voted' &&
      [2, 4, 6, 8, 10].includes(previewScoreParam)
      ? (previewScoreParam as AllowedScore)
      : null
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(window.navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Détecte la clôture d'un passage en direct pour basculer immédiatement sur « VOTE CLÔTURÉ »
  useEffect(() => {
    if (openPerformance) {
      const view: VotePosterDjView = {
        id: openPerformance.id,
        stageName: openPerformance.dj.stageName,
        roundName: openPerformance.roundName,
        performanceOrder: openPerformance.performanceOrder,
        photoUrl: openPerformance.dj.photoUrl,
      };
      prevOpenRef.current = view;
      setRecentClosedDj(null);
      return;
    }

    if (hasServerEmptyState) {
      prevOpenRef.current = null;
      setRecentClosedDj(null);
      return;
    }

    if (prevOpenRef.current) {
      setRecentClosedDj(prevOpenRef.current);
      prevOpenRef.current = null;
    }
  }, [openPerformance, hasServerEmptyState]);

  const previewDj = TEST_DJS[previewDjKey] ?? TEST_DJS['1']!;
  const nextPreviewKey =
    previewDjKey === '1' ? '2' : previewDjKey === '2' ? '3' : '1';
  const nextPreviewPhotoUrl = TEST_DJS[nextPreviewKey]?.photoUrl ?? null;

  const liveDj: VotePosterDjView | null = useMemo(() => {
    if (openPerformance) {
      return {
        id: openPerformance.id,
        stageName: openPerformance.dj.stageName,
        roundName: openPerformance.roundName,
        performanceOrder: openPerformance.performanceOrder,
        photoUrl: openPerformance.dj.photoUrl,
      };
    }
    if (live.data?.lastClosedPerformance) {
      return {
        id: live.data.lastClosedPerformance.id,
        stageName: live.data.lastClosedPerformance.stageName,
        roundName: live.data.lastClosedPerformance.roundName,
        performanceOrder: live.data.lastClosedPerformance.performanceOrder,
        photoUrl: live.data.lastClosedPerformance.photoUrl,
      };
    }
    if (recentClosedDj) {
      return recentClosedDj;
    }
    return null;
  }, [openPerformance, recentClosedDj, live.data]);

  if (allowPreview && previewMode) {
    const mappedPhase: VoteUiPhase =
      previewMode === 'inapp'
        ? 'in_app_browser'
        : previewMode === 'unauth'
          ? 'unauthenticated'
          : previewMode === 'waiting'
            ? 'waiting'
            : previewMode === 'closed'
              ? 'closed'
              : previewMode === 'error'
                ? 'error'
                : demoScore !== null
                  ? 'voted'
                  : 'open';

    return (
      <VotePosterScreen
        phase={mappedPhase}
        dj={
          mappedPhase === 'waiting'
            ? {
              id: 'waiting',
              stageName: 'EN ATTENTE',
              roundName: 'Prime 1',
              performanceOrder: 0,
              photoUrl: null,
            }
            : previewDj
        }
        nextDjPhotoUrl={nextPreviewPhotoUrl}
        currentScore={demoScore}
        scoreSubmitStatus={demoScore !== null ? 'success' : 'idle'}
        errorMessage={
          mappedPhase === 'error'
            ? 'Cet appareil est déjà utilisé avec un autre compte Google (ou hors ligne).'
            : null
        }
        inAppDetection={
          mappedPhase === 'in_app_browser'
            ? { isInApp: true, appName: 'WhatsApp' }
            : { isInApp: false, appName: null }
        }
        initialPickerOpen={previewMode === 'picker'}
        onSignInGoogle={() => void auth.signInWithGoogle('/vote')}
        onSelectScore={(score) => {
          setDemoScore(score);
        }}
        onRetry={() => void live.refresh()}
      />
    );
  }

  // Résolution de l'état réel de la session et du passage
  const isAdminSession =
    auth.isAuthenticated &&
    (auth.role === 'super_admin' || auth.role === 'moderator');

  let phase: VoteUiPhase = 'waiting';
  let errorMessage: string | null = null;

  const hasOAuthRedirectError =
    Boolean(oauthErrorParam) && !auth.isAuthenticated;

  if (inAppBrowser.isInApp) {
    phase = 'in_app_browser';
  } else if (!isOnline) {
    phase = 'error';
    errorMessage = 'Connexion réseau perdue. Vérifiez votre 3G/4G/Wi-Fi.';
  } else if (hasOAuthRedirectError) {
    phase = 'error';
    errorMessage =
      oauthErrorParam === 'access_denied'
        ? 'Connexion Google annulée. Appuyez sur « Réessayer » pour vous connecter.'
        : 'La connexion Google n’a pas abouti. Appuyez sur « Réessayer » pour recommencer.';
  } else if (live.status === 'error' && !live.data) {
    phase = 'error';
    errorMessage = live.error ?? 'Impossible de joindre le serveur du direct.';
  } else if (auth.status === 'error' && auth.error) {
    phase = 'error';
    errorMessage = auth.error;
  } else if (isAdminSession) {
    phase = 'error';
    errorMessage =
      'Session administrateur Régie active. Cliquez sur « Réessayer » pour vous déconnecter ou ouvrez une fenêtre privée pour voter.';
  } else if (bindingState.status === 'error' && bindingState.error) {
    phase = 'error';
    errorMessage = bindingState.error;
  } else if (scoring.status === 'error' && scoring.error) {
    phase = 'error';
    errorMessage = scoring.error;
  } else if (!openPerformance) {
    if (recentClosedDj || live.data?.lastClosedPerformance) {
      phase = 'closed';
    } else {
      phase = 'waiting';
    }
  } else if (!auth.isAuthenticated) {
    phase = 'unauthenticated';
  } else if (scoring.currentScore !== null) {
    phase = 'voted';
  } else {
    phase = 'open';
  }

  const isBindingPending =
    isActiveVoter &&
    bindingState.status !== 'success' &&
    bindingState.status !== 'error';
  const showTurnstileContainer =
    isBindingPending && phase !== 'in_app_browser';

  return (
    <>
      {turnstile.enabled ? (
        <div
          ref={turnstile.containerRef}
          className={
            showTurnstileContainer
              ? 'fixed bottom-24 left-1/2 z-50 -translate-x-1/2'
              : 'pointer-events-none fixed bottom-24 left-1/2 -z-10 -translate-x-1/2 opacity-0'
          }
          aria-hidden={!showTurnstileContainer}
        />
      ) : null}
      <VotePosterScreen
        phase={phase}
        roundStatus={live.data?.activeRound?.status ?? null}
        dj={
          phase === 'waiting'
            ? {
              id: 'waiting',
              stageName: 'EN ATTENTE',
              roundName: live.data?.activeRound?.name ?? 'Prime 1',
              performanceOrder: 0,
              photoUrl: null,
            }
            : liveDj
        }
        nextDjPhotoUrl={live.data?.nextPerformancePhotoUrl ?? null}
        currentScore={scoring.currentScore}
        scoreSubmitStatus={scoring.status}
        isBindingPending={isBindingPending}
        errorMessage={errorMessage}
        inAppDetection={inAppBrowser}
        onSignInGoogle={() => void auth.signInWithGoogle('/vote')}
        onSelectScore={async (score) => {
          if (bindingState.status !== 'success') {
            const bound = await rebindDevice(turnstile.token, {
              failIfTurnstilePending: true,
            });
            if (!bound) {
              return;
            }
          }
          await scoring.submitScore(score);
        }}
        onRetry={() => {
          if (hasOAuthRedirectError) {
            router.replace('/vote');
            void auth.refreshSession();
          } else if (auth.status === 'error') {
            void auth.refreshSession();
          } else if (isAdminSession) {
            void auth.signOut();
          } else if (bindingState.status === 'error') {
            void retryBinding(turnstile.reset);
          } else {
            if (scoring.status === 'error') {
              scoring.clearError();
            }
            void live.refresh();
          }
        }}
      />
    </>
  );
}

/**
 * Page publique de notation en direct `/vote`.
 */
export default function VotePage() {
  return (
    <Suspense
      fallback={
        <div className="vote-safe-screen poster-bg flex items-center justify-center text-sm font-black uppercase tracking-wider text-white">
          Chargement de la scène...
        </div>
      }
    >
      <VotePageContent />
    </Suspense>
  );
}
