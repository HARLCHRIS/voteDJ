'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, AlertTriangle } from 'lucide-react';
import { buildAndroidChromeIntentUrl } from '@/lib/security/in-app-browser';
import type { InAppBrowserDetection } from '@/types';

interface InAppBrowserBannerProps {
  detection: InAppBrowserDetection;
}

/**
 * Bannière bloquante affichée lorsqu'un votant ouvre le lien depuis le navigateur
 * intégré de WhatsApp, Facebook, Instagram ou TikTok (FR-9).
 */
export function InAppBrowserBanner({ detection }: InAppBrowserBannerProps) {
  const [copied, setCopied] = useState(false);

  if (!detection.isInApp) {
    return null;
  }

  const currentUrl =
    typeof window !== 'undefined' ? window.location.href : '';
  const androidIntentUrl = currentUrl
    ? buildAndroidChromeIntentUrl(currentUrl)
    : null;

  const handleCopy = async () => {
    if (!currentUrl || typeof navigator === 'undefined') {
      return;
    }
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback silencieux si le presse-papier est restreint
    }
  };

  return (
    <div
      role="alert"
      className="mx-auto mb-5 max-w-md rounded-2xl border-2 border-[#D9E81B] bg-[#09421A]/95 p-5 text-white shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-[#D9E81B]" />
        <div>
          <h2 className="text-base font-black uppercase tracking-wide text-[#D9E81B]">
            Ouvrez ce lien dans Chrome ou Safari
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-white/90">
            Vous avez ouvert le lien depuis{' '}
            <strong className="text-white">
              {detection.appName ?? 'une application'}
            </strong>
            . Google bloque la connexion dans les navigateurs intégrés.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#76E000] px-4 py-3 text-sm font-black uppercase text-[#063B1B] shadow-md transition active:scale-95"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Lien copié !
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copier le lien
            </>
          )}
        </button>

        {androidIntentUrl ? (
          <a
            href={androidIntentUrl}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20"
          >
            <ExternalLink className="h-4 w-4" />
            Ouvrir dans Chrome
          </a>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-white/75">
        Sur iPhone : touchez le menu <strong>•••</strong> ou l’icône{' '}
        <strong>Safari</strong> en bas à droite.
      </p>
    </div>
  );
}

