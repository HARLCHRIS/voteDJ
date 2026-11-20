'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Radio, ShieldCheck, Trophy, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FestivalHeaderProps {
  activeRoundName?: string | null;
  isLive?: boolean;
}

/**
 * En-tête officiel reprenant la disposition en deux médaillons logos à gauche
 * (Days Party + Eat & Drink Festival 2027) et le hashtag/statut à droite.
 */
export function FestivalHeader({
  activeRoundName,
  isLive = false,
}: FestivalHeaderProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Accueil', icon: Users },
    { href: '/vote', label: 'Voter', icon: Radio },
    { href: '/qualifies', label: 'Qualifiés', icon: Trophy },
    { href: '/admin', label: 'Régie', icon: ShieldCheck },
  ];

  return (
    <header className="relative z-30 mx-auto w-full max-w-5xl px-4 pt-3 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex items-center -space-x-2">
            <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-white/90 bg-white shadow-md transition-transform group-hover:scale-105 sm:h-11 sm:w-11">
              <Image
                src="/images/logo-eat-drink-2027.png"
                alt="Eat & Drink Festival Cotonou 2027"
                fill
                sizes="44px"
                className="object-contain p-0.5"
                priority
              />
            </div>
            <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-[#76E000] bg-black shadow-md transition-transform group-hover:scale-105 sm:h-11 sm:w-11">
              <Image
                src="/images/logo-days-party.png"
                alt="Days Party – Eat & Drink Cotonou"
                fill
                sizes="44px"
                className="object-contain p-0.5"
                priority
              />
            </div>
          </div>

          <div className="leading-tight">
            <p className="text-[10px] font-extrabold tracking-widest text-[#D9E81B] uppercase sm:text-xs">
              EAT &amp; DRINK FESTIVAL • COTONOU 2027
            </p>
            <p className="text-[11px] font-bold tracking-wider text-white/90 uppercase sm:text-xs">
              DAYS PARTY — DJ CHALLENGE
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {activeRoundName ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wider uppercase shadow-sm',
                isLive
                  ? 'bg-[#76E000] text-[#063B1B]'
                  : 'border border-white/25 bg-[#09421A]/80 text-white'
              )}
            >
              {isLive && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#8B1A1A]" />
              )}
              {activeRoundName}
            </span>
          ) : null}
          <span className="hidden text-xs font-extrabold tracking-wider text-white/80 uppercase sm:inline">
            #DJCHALLENGE
          </span>
        </div>
      </div>

      <nav
        aria-label="Navigation principale"
        className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={item.href === '/admin' ? false : undefined}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
                isActive
                  ? 'bg-white text-[#063B1B] shadow-sm'
                  : 'bg-black/25 text-white/85 hover:bg-black/40 hover:text-white'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

