'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface StylizedDjHeroNameProps {
  stageName: string;
  performanceOrder: number;
  roundName: string;
  isClosed?: boolean;
}

/**
 * Remplace la photo détourée par une mise en scène typographique géante et stylisée
 * du nom de scène du DJ au centre de la scène, optimisée mobile-first sans débordement.
 */
export function StylizedDjHeroName({
  stageName,
  performanceOrder,
  roundName,
  isClosed = false,
}: StylizedDjHeroNameProps) {
  const trimmed = stageName.trim();
  const hasDjPrefix = /^dj\s+/i.test(trimmed);
  const mainTitle = hasDjPrefix ? trimmed.replace(/^dj\s+/i, '') : trimmed;
  const len = mainTitle.length;

  const sizeClass =
    len >= 11
      ? 'text-[10.5vw] sm:text-[68px]'
      : len >= 7
        ? 'text-[13.5vw] sm:text-[84px]'
        : 'text-[18vw] sm:text-[104px]';

  return (
    <div className="relative flex w-full min-w-0 flex-col items-center justify-center px-2 text-center">
      {/* Halo vinyle Days Party agrandi derrière le nom */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-35"
      >
        <Image
          src="/images/logo-days-party.png"
          alt=""
          width={384}
          height={320}
          className="h-72 w-72 animate-vinyl-slow object-contain sm:h-96 sm:w-96"
        />
      </div>

      {/* Texte "VOTE" en grand au-dessus du badge sur scène */}
      <p
        aria-hidden="true"
        className="relative z-10 mb-2 -rotate-2 select-none text-[18vw] font-black leading-[0.85] tracking-tighter text-white uppercase drop-shadow-[0_6px_0_#04240E] [text-shadow:0_12px_28px_rgba(0,0,0,0.75)] sm:mb-3 sm:text-[92px]"
      >
        VOTE
      </p>

      {/* Badge Passage / En scène */}
      <div className="relative z-10 mb-2.5 inline-flex max-w-full items-center gap-2 rounded-full border border-[#6CE624]/60 bg-[#04240E]/85 px-3.5 py-1 text-[10px] font-black tracking-[0.14em] text-[#E5ED1B] uppercase shadow-lg backdrop-blur-xs sm:mb-3 sm:px-4 sm:py-1.5 sm:text-[11px]">
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            isClosed ? 'bg-red-400' : 'animate-pulse bg-[#6CE624]'
          )}
        />
        <span className="truncate">
          {isClosed
            ? `${roundName} • PASSAGE CLÔTURÉ`
            : `SUR SCÈNE • PASSAGE #${String(performanceOrder).padStart(2, '0')}`}
        </span>
      </div>

      {/* Typographie monumentale stylisée du nom du DJ */}
      <div className="relative z-10 w-full min-w-0 -rotate-2 transform px-1">
        {hasDjPrefix ? (
          <div className="mb-2 inline-block rounded-xl border-2 border-white/90 bg-[#09421A] px-5 py-1 shadow-[0_6px_0_#04240E]">
            <span className="text-2xl font-black tracking-[0.22em] text-[#E5ED1B] uppercase sm:text-4xl">
              DJ
            </span>
          </div>
        ) : null}

        <h1
          className={cn(
            'mx-auto w-full font-black uppercase leading-[0.88] tracking-[-0.05em] text-white drop-shadow-[0_7px_0_#04240E] [text-shadow:0_14px_30px_rgba(0,0,0,0.88)] break-words',
            sizeClass
          )}
        >
          {mainTitle}
        </h1>

        {/* Barre d'accentuation néon verte sous le nom */}
        <div
          aria-hidden="true"
          className="mx-auto mt-3 h-2 w-40 rounded-full bg-gradient-to-r from-[#6CE624] via-[#E5ED1B] to-[#28C840] shadow-[0_0_22px_rgba(108,230,36,0.75)] sm:mt-4 sm:h-2.5 sm:w-56"
        />
      </div>
    </div>
  );
}
