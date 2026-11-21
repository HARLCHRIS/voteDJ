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
  const [existingCheckVersion, setExistingCheckVersion] = useState(0);

  const boundUserIdRef = useRef<string | null>(null);
  const checkedExistingUserRef = useRef<string | null>(null);
  const existingCheckOutcomeRef = useRef<
    'bound' | 'needs_bind' | 'error' | null
  >(null);
  const usedTurnstileTokenRef = useRef<string | null>(null);
  const inFlightCheckRef = useRef<Promise<boolean> | null>(null);
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
   * Vérifie rapidement si le compte Google possède déjà un appareil actif lié
   * (évite d'exiger Cloudflare Turnstile aux votants déjà enregistrés).
   */
  const checkExistingBinding = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticatedVoter || !userId) {
      return false;
    }

    if (boundUserIdRef.current === userId) {
      return true;
    }

    if (inFlightCheckRef.current) {
      return inFlightCheckRef.current;
    }

    const generation = sessionGenerationRef.current;
    const token = deviceToken || getOrCreateClientDeviceToken();
    const fingerprint = collectLightweightFingerprint();
    let settled = false;

    setBindingState((prev) =>
      prev.status === 'loading' && prev.error === null
        ? prev
        : { status: 'loading', data: null, error: null }
    );

    const checkPromise = (async (): Promise<boolean> => {
      try {
        const res = await fetch('/api/device/bind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceToken: token,
            fingerprint,
            checkExistingOnly: true,
          }),
        });

        const payload = (await res.json()) as DeviceBindingResult & {
          error?: string;
        };

        if (sessionGenerationRef.current !== generation) {
          return false;
        }

        checkedExistingUserRef.current = userId;

        if (!res.ok) {
          existingCheckOutcomeRef.current = 'error';
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

        if (payload.bound) {
          existingCheckOutcomeRef.current = 'bound';
          boundUserIdRef.current = userId;
          setBindingState({
            status: 'success',
            data: payload,
            error: null,
          });
          return true;
        }

        existingCheckOutcomeRef.current = 'needs_bind';
        setExistingCheckVersion((prev) => prev + 1);
        return false;
      } catch (err) {
        if (sessionGenerationRef.current !== generation) {
          return false;
        }
        checkedExistingUserRef.current = userId;
        existingCheckOutcomeRef.current = 'error';
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
        inFlightCheckRef.current = null;
      }
    })();

    if (!settled) {
      inFlightCheckRef.current = checkPromise;
    }

    return checkPromise;
  }, [deviceToken, isAuthenticatedVoter, userId]);

  /**
   * Lie l'appareil courant au compte Google connecté via `/api/device/bind`.
   * Déduplique les appels concurrents et empêche la réutilisation d'un jeton Turnstile déjà consommé.
   */
  const bindDevice = useCallback(
    async (
      explicitTurnstileToken?: string | null,
      options?: { failIfTurnstilePending?: boolean }
    ): Promise<boolean> => {
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
          const shouldFail =
            turnstileStatus === 'error' || Boolean(options?.failIfTurnstilePending);
          setBindingState({
            status: shouldFail ? 'error' : 'loading',
            data: null,
            error: shouldFail
              ? (turnstileError ??
                'Vérification de sécurité en cours ou bloquée. Appuyez sur Réessayer.')
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
      inFlightCheckRef.current = null;
      inFlightBindRef.current = null;
      checkedExistingUserRef.current = null;
      existingCheckOutcomeRef.current = null;
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

    if (turnstileEnabled && checkedExistingUserRef.current !== userId) {
      void checkExistingBinding();
      return;
    }

    if (turnstileEnabled && existingCheckOutcomeRef.current !== 'needs_bind') {
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
    existingCheckVersion,
    checkExistingBinding,
    bindDevice,
  ]);

  /**
   * Relance la vérification ou la liaison de l'appareil après une erreur.
   */
  const retryBinding = useCallback(
    async (resetTurnstile?: () => void): Promise<boolean> => {
      if (!isAuthenticatedVoter || !userId) {
        return false;
      }

      if (boundUserIdRef.current === userId) {
        return true;
      }

      if (
        turnstileEnabled &&
        existingCheckOutcomeRef.current !== 'needs_bind'
      ) {
        checkedExistingUserRef.current = null;
        existingCheckOutcomeRef.current = null;
        if (turnstileStatus === 'error') {
          resetTurnstile?.();
        }
        return checkExistingBinding();
      }

      if (turnstileEnabled) {
        resetTurnstile?.();
        return false;
      }

      return bindDevice();
    },
    [
      isAuthenticatedVoter,
      userId,
      turnstileEnabled,
      turnstileStatus,
      checkExistingBinding,
      bindDevice,
    ]
  );

  return {
    inAppBrowser,
    deviceToken,
    bindingState,
    rebindDevice: bindDevice,
    retryBinding,
  };
}
