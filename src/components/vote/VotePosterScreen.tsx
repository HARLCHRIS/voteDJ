'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, Loader2, RefreshCw, AlertOctagon } from 'lucide-react';
import { CheckmarkBadge3D } from '@/components/shared/CheckmarkBadge3D';
import { InAppBrowserBanner } from '@/components/vote/InAppBrowserBanner';
import { StylizedDjHeroName } from '@/components/vote/StylizedDjHeroName';
import { cn } from '@/lib/utils';
import {
  ALLOWED_SCORES,
  type AllowedScore,
  type InAppBrowserDetection,
  type RequestStatus,
  type RoundName,
} from '@/types';

export type VoteUiPhase =
  | 'unauthenticated'
  | 'waiting'
  | 'open'
  | 'voted'
  | 'closed'
  | 'error'
  | 'in_app_browser';

export interface VotePosterDjView {
  id: string;
  stageName: string;
  roundName: RoundName;
  performanceOrder: number;
  photoUrl: string | null;
}

interface VotePosterScreenProps {
  phase: VoteUiPhase;
  dj: VotePosterDjView | null;
  nextDjPhotoUrl?: string | null;
  currentScore: AllowedScore | null;
  scoreSubmitStatus: RequestStatus;
  isBindingPending?: boolean;
  errorMessage?: string | null;
  inAppDetection: InAppBrowserDetection;
  initialPickerOpen?: boolean;
  onSignInGoogle: () => void;
  onSelectScore: (score: AllowedScore) => Promise<void> | void;
  onRetry?: () => void;
}

/**
 * Écran de notation public mobile-first plein écran (`100dvh`) :
 * - Fond de scène DJ atmosphérique (projecteurs vert émeraude & platines)
 * - Nom de scène du DJ en typographie géante stylisée au centre (ou photo détourée si fournie)
 * - Pastilles 3D vertes à coche flottantes et bandeau bas bicolore avec bouton NOTER
 */
export function VotePosterScreen({
  phase,
  dj,
  nextDjPhotoUrl,
  currentScore,
  scoreSubmitStatus,
  isBindingPending = false,
  errorMessage,
  inAppDetection,
  initialPickerOpen = false,
  onSignInGoogle,
  onSelectScore,
  onRetry,
}: VotePosterScreenProps) {
  const [pickerOpen, setPickerOpen] = useState(initialPickerOpen);
  const [pendingScore, setPendingScore] = useState<AllowedScore | null>(null);

  useEffect(() => {
    if (!nextDjPhotoUrl || typeof window === 'undefined') {
      return;
    }
    const preloadImg = new window.Image();
    preloadImg.src = nextDjPhotoUrl;
  }, [nextDjPhotoUrl]);

  useEffect(() => {
    if (phase !== 'open' || isBindingPending) {
      setPickerOpen(false);
      setPendingScore(null);
    }
  }, [phase, isBindingPending]);

  const isSubmittingScore =
    scoreSubmitStatus === 'loading' || pendingScore !== null;

  const handleScoreClick = async (score: AllowedScore) => {
    if (phase !== 'open' || isBindingPending || isSubmittingScore) {
      return;
    }
    setPendingScore(score);
    try {
      await onSelectScore(score);
      setPickerOpen(false);
    } finally {
      setPendingScore(null);
    }
  };

  const showDjCenterpiece =
    phase !== 'waiting' && phase !== 'in_app_browser' && dj !== null;

  const isActionClickable =
    phase === 'unauthenticated' ||
    (phase === 'open' && !isBindingPending) ||
    phase === 'error';

  const handleLeftBlockClick = () => {
    if (phase === 'unauthenticated') {
      onSignInGoogle();
      return;
    }
    if (phase === 'open') {
      if (isBindingPending) return;
      setPickerOpen((prev) => !prev);
      return;
    }
    if (phase === 'error' && onRetry) {
      onRetry();
    }
  };

  return (
    <div className="vote-safe-screen poster-bg relative flex h-[100dvh] w-full max-w-[100vw] flex-col justify-between overflow-hidden select-none">
      {nextDjPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={nextDjPhotoUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      ) : null}

      {/* COUCHE 1 : Fond de scène DJ + voile dégradé émeraude */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
      >
        <Image
          src="/images/dj-stage-bg.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center opacity-75"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#042A13]/75 via-[#085124]/45 to-[#03200D]/90" />
      </div>

      {/* COUCHE 3 : Pastilles vertes 3D flottantes dimensionnées pour mobile */}
      <div className="pointer-events-none absolute top-[14dvh] -left-4 z-25 animate-float-badge sm:left-[calc(50%-240px)]">
        <CheckmarkBadge3D
          size="md"
          active={phase === 'voted'}
          className="h-14 w-14 sm:h-20 sm:w-20"
        />
      </div>
      <div
        className="pointer-events-none absolute top-[12dvh] -right-3 z-25 animate-float-badge sm:right-[calc(50%-240px)]"
        style={{ animationDelay: '1.4s' }}
      >
        <CheckmarkBadge3D
          size="md"
          active={phase === 'voted'}
          className="h-12 w-12 sm:h-16 sm:w-16"
        />
      </div>

      {/* COUCHE 4 (HAUT) : Logos du festival à gauche, hashtag à droite */}
      <header className="relative z-30 mx-auto flex w-full max-w-md shrink-0 items-center justify-between gap-2 pt-1">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <div className="flex shrink-0 items-center -space-x-2">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white shadow-md">
              <Image
                src="/images/logo-eat-drink-2027.png"
                alt="Eat & Drink Festival Cotonou 2027"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                priority
              />
            </div>
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-[#6CE624] bg-black shadow-md">
              <Image
                src="/images/logo-days-party.png"
                alt="Days Party"
                width={32}
                height={28}
                className="h-8 w-8 object-contain"
                priority
              />
            </div>
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[9px] font-extrabold tracking-wider text-white uppercase sm:text-[10px]">
              EAT &amp; DRINK FESTIVAL
            </p>
            <p className="truncate text-[9px] font-bold tracking-wider text-white/85 uppercase sm:text-[10px]">
              COTONOU 2027 • DAYS PARTY
            </p>
          </div>
        </Link>

        <span className="shrink-0 text-[10px] font-extrabold tracking-wider text-white/95 uppercase sm:text-xs">
          #DJCHALLENGE
        </span>
      </header>

      {/* COUCHE 2 : Nom du DJ stylisé en grand au centre */}
      <div className="pointer-events-none relative z-20 mx-auto flex w-full min-w-0 max-w-xl flex-1 items-center justify-center overflow-hidden">
        {showDjCenterpiece ? (
          <div
            key={dj.id}
            className="animate-dj-enter flex w-full items-center justify-center"
          >
            {dj.photoUrl ? (
              <div className="relative -mb-10 flex h-[54dvh] max-h-[480px] w-full items-end justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={dj.photoUrl}
                  alt={dj.stageName}
                  className="h-full w-auto max-w-[90%] object-contain object-bottom drop-shadow-[0_14px_28px_rgba(0,0,0,0.65)]"
                />
              </div>
            ) : (
              <StylizedDjHeroName
                stageName={dj.stageName}
                performanceOrder={dj.performanceOrder}
                roundName={dj.roundName}
                isClosed={phase === 'closed'}
              />
            )}
          </div>
        ) : phase === 'waiting' ? (
          <div className="flex flex-col items-center justify-center text-center">
            <Image
              src="/images/logo-days-party.png"
              alt="En attente du prochain passage"
              width={288}
              height={240}
              className="h-56 w-56 animate-vinyl-slow object-contain opacity-95 drop-shadow-[0_12px_28px_rgba(0,0,0,0.65)] sm:h-72 sm:w-72"
              priority
            />
            <p className="mt-4 rounded-full border border-white/25 bg-black/50 px-4 py-1.5 text-xs font-extrabold tracking-[0.2em] text-[#E5ED1B] uppercase backdrop-blur-xs">
              SCÈNE EN PRÉPARATION
            </p>
          </div>
        ) : null}
      </div>

      {/* COUCHE 5 (BAS) : Panneau de notes rondes >=56px + Bandeau blanc bicolore */}
      <div className="relative z-40 mx-auto w-full max-w-[410px] shrink-0 pb-1">
        {phase === 'error' && errorMessage ? (
          <div
            role="alert"
            className="mb-2.5 flex items-center gap-2 rounded-xl border border-red-300/60 bg-[#5C0D0D]/95 px-3 py-2 text-[11px] font-bold text-white shadow-xl sm:text-xs"
          >
            <AlertOctagon className="h-4 w-4 shrink-0 text-[#E5ED1B]" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {pickerOpen && phase === 'open' ? (
          <div
            role="group"
            aria-label="Choisir une note de 2 à 10"
            className="mb-2.5 flex items-center justify-between gap-1.5 rounded-2xl border-2 border-white/85 bg-[#04240F]/95 px-2.5 py-2.5 shadow-[0_16px_36px_rgba(0,0,0,0.65)] backdrop-blur-sm sm:gap-2 sm:px-3 sm:py-3"
          >
            {ALLOWED_SCORES.map((value) => {
              const isSelected =
                currentScore === value || pendingScore === value;
              const isSubmitting = isSubmittingScore && isSelected;

              return (
                <button
                  key={value}
                  type="button"
                  disabled={isSubmittingScore}
                  onClick={() => void handleScoreClick(value)}
                  aria-label={`Attribuer la note ${value} sur 10`}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex h-14 w-14 min-h-[56px] min-w-[56px] items-center justify-center rounded-full border-[3px] text-xl font-black transition-transform active:scale-95 disabled:opacity-60',
                    isSelected
                      ? 'border-white bg-gradient-to-b from-[#6CE624] to-[#28C840] text-[#063B1B] shadow-[0_4px_0_#0D6E1E] scale-105'
                      : 'border-[#6CE624]/70 bg-[#09421A] text-[#E5ED1B] shadow-[0_4px_0_#041A0B] hover:border-white hover:bg-[#0C6B32]'
                  )}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    value
                  )}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Bandeau blanc aux coins légèrement arrondis, découpé en 2 parties */}
        <div className="relative mx-auto w-[96%] -rotate-1 transform sm:w-full">
          <div className="pointer-events-none absolute -top-3.5 -right-1.5 z-50">
            <CheckmarkBadge3D size="sm" active={phase === 'voted'} />
          </div>

          <div
            className={cn(
              'grid grid-cols-12 overflow-hidden rounded-lg border-[3px] border-white bg-white shadow-[0_18px_40px_rgba(0,0,0,0.65)] sm:border-[4px]',
              phase === 'waiting' && 'opacity-90'
            )}
          >
            {/* PARTIE GAUCHE */}
            <button
              type="button"
              disabled={!isActionClickable}
              onClick={handleLeftBlockClick}
              className={cn(
                'col-span-6 flex min-h-[64px] items-center justify-center px-2.5 py-2 text-center transition focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#E5ED1B] sm:min-h-[68px] sm:px-3',
                phase === 'waiting' &&
                  'cursor-default bg-[#4B554E] text-white/90',
                phase === 'closed' &&
                  'cursor-default bg-[#5C1212] text-white',
                phase === 'voted' &&
                  'cursor-default bg-[#09421A] text-[#E5ED1B]',
                phase === 'error' &&
                  'bg-[#7D1515] text-[#E5ED1B] hover:bg-[#931B1B]',
                phase === 'open' &&
                  isBindingPending &&
                  'cursor-wait bg-[#09421A] text-[#E5ED1B]/90',
                ((phase === 'open' && !isBindingPending) ||
                  phase === 'unauthenticated') &&
                  'bg-[#09421A] text-[#E5ED1B] hover:bg-[#0D5924] active:brightness-95'
              )}
            >
              {phase === 'unauthenticated' ? (
                <span className="text-[11px] font-black leading-tight tracking-wide uppercase sm:text-xs">
                  SE CONNECTER AVEC GOOGLE
                </span>
              ) : null}

              {phase === 'waiting' ? (
                <span className="text-xs font-black tracking-wide uppercase sm:text-sm">
                  PROCHAIN DJ…
                </span>
              ) : null}

              {phase === 'open' ? (
                isBindingPending ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black tracking-wide uppercase sm:text-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    VÉRIFICATION…
                  </span>
                ) : (
                  <span className="text-lg font-black tracking-wider uppercase sm:text-xl">
                    NOTER
                  </span>
                )
              ) : null}

              {phase === 'voted' && currentScore !== null ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-black tracking-wide uppercase sm:text-base">
                  <Check className="h-4 w-4 stroke-[3.5] text-[#6CE624]" />
                  TA NOTE : {currentScore}
                </span>
              ) : null}

              {phase === 'closed' ? (
                <span className="text-xs font-black tracking-wider uppercase sm:text-sm">
                  VOTE CLÔTURÉ
                </span>
              ) : null}

              {phase === 'error' ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-black tracking-wide uppercase">
                  <RefreshCw className="h-3.5 w-3.5" />
                  RÉESSAYER
                </span>
              ) : null}
            </button>

            {/* PARTIE DROITE */}
            <div className="col-span-6 flex min-h-[64px] flex-col justify-center bg-white px-2.5 py-2 text-left sm:min-h-[68px] sm:px-3">
              <p className="truncate text-sm font-black leading-tight tracking-tight text-[#111111] uppercase sm:text-base">
                {phase === 'waiting'
                  ? 'EN ATTENTE'
                  : (dj?.stageName ?? 'DJ CHALLENGE')}
              </p>
              <p className="mt-0.5 text-[10px] font-extrabold tracking-wide text-[#8B1A1A] uppercase sm:text-[11px]">
                {phase === 'waiting'
                  ? (dj?.roundName ?? 'PRIME 1')
                  : phase === 'closed'
                    ? `${dj?.roundName ?? 'PRIME 1'} • TERMINÉ`
                    : `${dj?.roundName ?? 'PRIME 1'}`}
              </p>
              <p className="mt-0.5 text-[9px] font-bold tracking-wider text-neutral-600 uppercase">
                EAT &amp; DRINK COTONOU
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* COUCHE 6 : Overlay navigateur intégré WhatsApp / Facebook / Instagram */}
      {phase === 'in_app_browser' ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-xs">
          <InAppBrowserBanner detection={inAppDetection} />
        </div>
      ) : null}
    </div>
  );
}
