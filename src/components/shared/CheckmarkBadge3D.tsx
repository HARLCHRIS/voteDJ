'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckmarkBadge3DProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  active?: boolean;
}

/**
 * Médaillon 3D vert avec coche blanche, inspiré directement des badges
 * flottants de l'affiche de référence « VOTE ».
 */
export function CheckmarkBadge3D({
  size = 'md',
  className,
  active = false,
}: CheckmarkBadge3DProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 border-2',
    md: 'h-14 w-14 border-[3px]',
    lg: 'h-20 w-20 border-4',
  }[size];

  const iconSizes = {
    sm: 'h-4 w-4 stroke-[3.5]',
    md: 'h-7 w-7 stroke-[3.5]',
    lg: 'h-10 w-10 stroke-[3.5]',
  }[size];

  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative flex items-center justify-center rounded-full border-[#9CFF38]/70 bg-gradient-to-br from-[#52E838] via-[#28C840] to-[#117A22] shadow-[0_8px_0_#0A4E16,0_14px_24px_rgba(0,0,0,0.45)] transition-transform duration-300',
        active && 'scale-110 ring-4 ring-[#D9E81B]/70',
        sizeClasses,
        className
      )}
    >
      <div className="pointer-events-none absolute inset-1 rounded-full bg-gradient-to-b from-white/35 to-transparent" />
      <Check
        className={cn(
          'relative text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.4)]',
          iconSizes
        )}
      />
    </div>
  );
}

