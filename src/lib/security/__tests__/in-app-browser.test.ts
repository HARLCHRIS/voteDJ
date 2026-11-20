import { describe, expect, it } from 'vitest';
import {
  buildAndroidChromeIntentUrl,
  detectInAppBrowser,
} from '@/lib/security/in-app-browser';

describe('detectInAppBrowser', () => {
  it('détecte WhatsApp, Facebook, Instagram et TikTok', () => {
    expect(detectInAppBrowser('Mozilla/5.0 WhatsApp/2.24.1')).toEqual({
      isInApp: true,
      appName: 'WhatsApp',
    });
    expect(detectInAppBrowser('Mozilla/5.0 [FBAN/FBIOS;FBAV/410.0]')).toEqual({
      isInApp: true,
      appName: 'Facebook',
    });
    expect(detectInAppBrowser('Mozilla/5.0 Instagram 301.0')).toEqual({
      isInApp: true,
      appName: 'Instagram',
    });
    expect(detectInAppBrowser('Mozilla/5.0 BytedanceWebview/d8a21c6 TikTok')).toEqual({
      isInApp: true,
      appName: 'TikTok',
    });
  });

  it('autorise Safari et Chrome standards', () => {
    expect(
      detectInAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
      )
    ).toEqual({ isInApp: false, appName: null });
  });

  it('génère un lien intent Chrome Android valide', () => {
    expect(buildAndroidChromeIntentUrl('https://vote.festival.bj/vote')).toBe(
      'intent://vote.festival.bj/vote#Intent;scheme=https;package=com.android.chrome;end'
    );
  });
});

