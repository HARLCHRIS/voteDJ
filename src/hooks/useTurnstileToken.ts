'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RequestStatus, TurnstileGlobalApi } from '@/types';

declare global {
  interface Window {
    turnstile?: TurnstileGlobalApi;
  }
}

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';
const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_SCRIPT_TIMEOUT_MS = 6000;
const TURNSTILE_WIDGET_TIMEOUT_MS = 15000;

interface UseTurnstileTokenOptions {
  active: boolean;
}

/**
 * Charge et pilote le widget Cloudflare Turnstile en mode `interaction-only`
 * (invisible pour les votants légitimes) afin d'obtenir un jeton anti-robot.
 * Gère les 3 états : loading / success / error.
 */
export function useTurnstileToken({ active }: UseTurnstileTokenOptions) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
  const enabled = Boolean(siteKey) && active;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const [reloadAttempt, setReloadAttempt] = useState(0);
  const [scriptReady, setScriptReady] = useState(false);
  const [status, setStatus] = useState<RequestStatus>(
    enabled ? 'loading' : 'success'
  );
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const renderWidget = useCallback(() => {
    if (!enabled || !siteKey || !containerRef.current || !window.turnstile) {
      return;
    }

    setScriptReady(true);

    if (widgetIdRef.current) {
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        appearance: 'interaction-only',
        callback: (issuedToken: string) => {
          setToken(issuedToken);
          setStatus('success');
          setError(null);
        },
        'expired-callback': () => {
          setToken(null);
          setStatus('loading');
          if (widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
          }
        },
        'error-callback': () => {
          setToken(null);
          setStatus('error');
          setError('Vérification anti-robot Cloudflare bloquée. Rechargez la page.');
        },
      });
    } catch {
      widgetIdRef.current = null;
      setToken(null);
      setStatus('error');
      setError('Impossible d’initialiser la protection anti-robot Cloudflare.');
    }
  }, [enabled, siteKey]);

  useEffect(() => {
    if (!enabled) {
      setScriptReady(false);
      setStatus('success');
      setToken(null);
      setError(null);
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    if (window.turnstile) {
      renderWidget();
      return () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }

    setScriptReady(false);
    setStatus('loading');
    let scriptEl = document.getElementById(
      TURNSTILE_SCRIPT_ID
    ) as HTMLScriptElement | null;

    const handleLoad = () => {
      renderWidget();
    };
    const handleError = () => {
      scriptEl?.remove();
      setScriptReady(false);
      setToken(null);
      setStatus('error');
      setError('Impossible de charger la protection anti-robot Cloudflare.');
    };

    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = TURNSTILE_SCRIPT_ID;
      scriptEl.src = TURNSTILE_SCRIPT_SRC;
      scriptEl.async = true;
      scriptEl.defer = true;
      document.head.appendChild(scriptEl);
    }

    scriptEl.addEventListener('load', handleLoad);
    scriptEl.addEventListener('error', handleError);

    return () => {
      scriptEl?.removeEventListener('load', handleLoad);
      scriptEl?.removeEventListener('error', handleError);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [enabled, reloadAttempt, renderWidget]);

  useEffect(() => {
    if (!enabled || status !== 'loading' || typeof window === 'undefined') {
      return;
    }

    // Évite qu'un script Cloudflare bloqué ou lent laisse le bouton de vote bloqué indéfiniment
    const timeoutMs =
      scriptReady || Boolean(window.turnstile)
        ? TURNSTILE_WIDGET_TIMEOUT_MS
        : TURNSTILE_SCRIPT_TIMEOUT_MS;

    const timerId = window.setTimeout(() => {
      setToken(null);
      setStatus('error');
      setError(
        'Vérification de sécurité trop longue (réseau ou bloqueur). Appuyez sur Réessayer.'
      );
    }, timeoutMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [enabled, status, scriptReady, reloadAttempt]);

  /**
   * Réinitialise le widget Turnstile (ou recharge le script en cas d'échec réseau)
   * afin d'obtenir un nouveau jeton anti-robot à usage unique.
   */
  const reset = useCallback(() => {
    if (!enabled) return;
    setToken(null);
    setStatus('loading');
    setError(null);
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        widgetIdRef.current = null;
        renderWidget();
      }
    } else if (window.turnstile) {
      renderWidget();
    } else {
      setScriptReady(false);
      document.getElementById(TURNSTILE_SCRIPT_ID)?.remove();
      setReloadAttempt((prev) => prev + 1);
    }
  }, [enabled, renderWidget]);

  return {
    enabled: Boolean(siteKey),
    status,
    token,
    error,
    containerRef,
    reset,
  };
}

