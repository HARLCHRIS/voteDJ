'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collectLightweightFingerprint,
  getOrCreateClientDeviceToken,
} from '@/lib/security/device-client';
import { detectInAppBrowser } from '@/lib/security/in-app-browser';
import type {
  AsyncState,
  DeviceBindingResult,
  InAppBrowserDetection,
  RequestStatus,
} from '@/types';

interface UseDeviceBindingOptions {
  isAuthenticatedVoter: boolean;
  userId: string | null;
  turnstileEnabled?: boolean;
  turnstileToken?: string | null;
  turnstileStatus?: RequestStatus;
  turnstileError?: string | null;
}

/**
 * Hook gérant la détection du navigateur intégré (WhatsApp/FB/IG/TikTok)
 * et la liaison stricte 1 compte Google ↔ 1 appareil auprès du serveur
 * après validation Cloudflare Turnstile si activée.
 */
export function useDeviceBinding({
  isAuthenticatedVoter,
  userId,
  turnstileEnabled = false,
  turnstileToken = null,
  turnstileStatus = 'success',
  turnstileError = null,
}: UseDeviceBindingOptions) {
  const [inAppBrowser, setInAppBrowser] = useState<InAppBrowserDetection>({
    isInApp: false,
    appName: null,
  });
  const [deviceToken, setDeviceToken] = useState<string>('');
  const [bindingState, setBindingState] = useState<
    AsyncState<DeviceBindingResult>
  >({
    status: 'idle',
    data: null,
    error: null,
  });

  const boundUserIdRef = useRef<string | null>(null);
  const usedTurnstileTokenRef = useRef<string | null>(null);
  const inFlightBindRef = useRef<Promise<boolean> | null>(null);
  const inFlightAttemptIdRef = useRef<number>(0);
  const sessionGenerationRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setInAppBrowser(detectInAppBrowser(window.navigator.userAgent));
    setDeviceToken(getOrCreateClientDeviceToken());
  }, []);

  /**
   * Lie l'appareil courant au compte Google connecté via `/api/device/bind`.
   * Déduplique les appels concurrents et empêche la réutilisation d'un jeton Turnstile déjà consommé.
   */
  const bindDevice = useCallback(
    async (explicitTurnstileToken?: string | null): Promise<boolean> => {
      if (!isAuthenticatedVoter || !userId) {
        return false;
      }

      if (boundUserIdRef.current === userId) {
        return true;
      }

      if (inFlightBindRef.current) {
        return inFlightBindRef.current;
      }

      const effectiveTurnstileToken =
        explicitTurnstileToken !== undefined
          ? explicitTurnstileToken
          : turnstileToken;

      if (turnstileEnabled) {
        if (!effectiveTurnstileToken) {
          setBindingState({
            status: turnstileStatus === 'error' ? 'error' : 'loading',
            data: null,
            error:
              turnstileStatus === 'error'
                ? (turnstileError ?? 'Vérification anti-robot impossible.')
                : null,
          });
          return false;
        }

        if (usedTurnstileTokenRef.current === effectiveTurnstileToken) {
          setBindingState({
            status: 'error',
            data: null,
            error:
              'Jeton anti-robot expiré ou déjà utilisé. Appuyez sur Réessayer.',
          });
          return false;
        }

        usedTurnstileTokenRef.current = effectiveTurnstileToken;
      }

      const generation = sessionGenerationRef.current;
      const attemptId = ++inFlightAttemptIdRef.current;
      const token = deviceToken || getOrCreateClientDeviceToken();
      const fingerprint = collectLightweightFingerprint();
      let settled = false;

      setBindingState({ status: 'loading', data: null, error: null });

      const requestPromise = (async (): Promise<boolean> => {
        try {
          const res = await fetch('/api/device/bind', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceToken: token,
              fingerprint,
              turnstileToken: effectiveTurnstileToken ?? null,
            }),
          });

          const payload = (await res.json()) as DeviceBindingResult & {
            error?: string;
          };

          if (sessionGenerationRef.current !== generation) {
            return false;
          }

          if (!res.ok || !payload.bound) {
            setBindingState({
              status: 'error',
              data: payload,
              error:
                payload.message ||
                payload.error ||
                'Cet appareil ne peut pas être utilisé avec ce compte.',
            });
            return false;
          }

          boundUserIdRef.current = userId;
          setBindingState({
            status: 'success',
            data: payload,
            error: null,
          });
          return true;
        } catch (err) {
          if (sessionGenerationRef.current !== generation) {
            return false;
          }
          setBindingState({
            status: 'error',
            data: null,
            error:
              err instanceof Error
                ? err.message
                : 'Impossible de vérifier la liaison de votre appareil.',
          });
          return false;
        } finally {
          settled = true;
          if (inFlightAttemptIdRef.current === attemptId) {
            inFlightBindRef.current = null;
          }
        }
      })();

      if (!settled && inFlightAttemptIdRef.current === attemptId) {
        inFlightBindRef.current = requestPromise;
      }
      return requestPromise;
    },
    [
      deviceToken,
      isAuthenticatedVoter,
      userId,
      turnstileEnabled,
      turnstileToken,
      turnstileStatus,
      turnstileError,
    ]
  );

  useEffect(() => {
    if (!isAuthenticatedVoter || !userId) {
      sessionGenerationRef.current += 1;
      inFlightAttemptIdRef.current += 1;
      inFlightBindRef.current = null;
      boundUserIdRef.current = null;
      usedTurnstileTokenRef.current = null;
      setBindingState({ status: 'idle', data: null, error: null });
      return;
    }

    if (!deviceToken) {
      return;
    }

    if (boundUserIdRef.current === userId) {
      return;
    }

    if (turnstileEnabled) {
      if (turnstileStatus === 'error') {
        setBindingState({
          status: 'error',
          data: null,
          error:
            turnstileError ??
            'Vérification anti-robot Cloudflare impossible.',
        });
        return;
      }
      if (turnstileStatus === 'loading' || !turnstileToken) {
        if (!inFlightBindRef.current) {
          setBindingState((prev) =>
            prev.status === 'loading' && prev.error === null
              ? prev
              : { status: 'loading', data: null, error: null }
          );
        }
        return;
      }
      if (usedTurnstileTokenRef.current === turnstileToken) {
        return;
      }
    }

    void bindDevice(turnstileToken);
  }, [
    isAuthenticatedVoter,
    userId,
    deviceToken,
    turnstileEnabled,
    turnstileToken,
    turnstileStatus,
    turnstileError,
    bindDevice,
  ]);

  return {
    inAppBrowser,
    deviceToken,
    bindingState,
    rebindDevice: bindDevice,
  };
}
