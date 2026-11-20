const DEVICE_STORAGE_KEY = 'dj_challenge_device_token';

/**
 * Récupère ou génère un jeton aléatoire d'appareil conservé dans `localStorage`.
 * Utilisé conjointement avec le cookie sécurisé serveur pour lier 1 appareil à 1 compte.
 */
export function getOrCreateClientDeviceToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing && existing.length >= 16) {
      return existing;
    }

    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;

    window.localStorage.setItem(DEVICE_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `fallback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Collecte une empreinte légère et non intrusive du navigateur
 * (User-Agent, langue, fuseau horaire, dimensions d'écran) pour signal secondaire.
 */
export function collectLightweightFingerprint(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const ua = navigator.userAgent || '';
  const lang = navigator.language || '';
  const tz =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      : '';
  const screenInfo =
    typeof window.screen !== 'undefined'
      ? `${window.screen.width}x${window.screen.height}x${window.devicePixelRatio || 1}`
      : '';

  return [ua, lang, tz, screenInfo].join('|');
}

