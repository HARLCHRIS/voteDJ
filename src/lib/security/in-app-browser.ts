import type { InAppBrowserDetection } from '@/types';

/**
 * Détecte si l'utilisateur navigue dans un navigateur intégré (WebView)
 * d'une application tierce (WhatsApp, Facebook, Instagram, TikTok),
 * où Google OAuth est bloqué (`disallowed_useragent`).
 */
export function detectInAppBrowser(userAgent: string): InAppBrowserDetection {
  if (!userAgent) {
    return { isInApp: false, appName: null };
  }

  const ua = userAgent.toLowerCase();

  if (ua.includes('whatsapp')) {
    return { isInApp: true, appName: 'WhatsApp' };
  }
  if (ua.includes('fban') || ua.includes('fbav') || ua.includes('fb_iab')) {
    return { isInApp: true, appName: 'Facebook' };
  }
  if (ua.includes('instagram')) {
    return { isInApp: true, appName: 'Instagram' };
  }
  if (ua.includes('tiktok') || ua.includes('bytedance') || ua.includes('musical_ly')) {
    return { isInApp: true, appName: 'TikTok' };
  }
  if (ua.includes('snapchat') || ua.includes('line/')) {
    return { isInApp: true, appName: 'Autre' };
  }

  return { isInApp: false, appName: null };
}

/**
 * Construit un lien `intent://` Android permettant de tenter l'ouverture directe
 * de l'URL courante dans Google Chrome depuis une WebView Android.
 */
export function buildAndroidChromeIntentUrl(currentUrl: string): string | null {
  try {
    const parsed = new URL(currentUrl);
    const pathAndQuery = `${parsed.host}${parsed.pathname}${parsed.search}`;
    return `intent://${pathAndQuery}#Intent;scheme=${parsed.protocol.replace(':', '')};package=com.android.chrome;end`;
  } catch {
    return null;
  }
}

