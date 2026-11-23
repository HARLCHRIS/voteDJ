import { describe, expect, it } from 'vitest';
import { resolvePublicOrigin } from '@/lib/supabase/origin';

describe('resolvePublicOrigin', () => {
  it('privilégie x-forwarded-host et x-forwarded-proto derrière un proxy', () => {
    const origin = resolvePublicOrigin({
      url: 'http://localhost:3000/auth/callback?code=123',
      headers: new Headers({
        'x-forwarded-host': 'dj-challenge.vercel.app, internal-proxy',
        'x-forwarded-proto': 'https, http',
        host: 'localhost:3000',
      }),
    });

    expect(origin).toBe('https://dj-challenge.vercel.app');
  });

  it('utilise host public si x-forwarded-host est absent', () => {
    const origin = resolvePublicOrigin({
      url: 'http://127.0.0.1:3000/auth/callback',
      headers: new Headers({
        host: 'vote.eatanddrinkcotonou.bj',
        'x-forwarded-proto': 'https',
      }),
    });

    expect(origin).toBe('https://vote.eatanddrinkcotonou.bj');
  });

  it('retombe sur url.origin pour localhost et 127.0.0.1 en développement local', () => {
    expect(
      resolvePublicOrigin({
        url: 'http://localhost:3000/auth/callback',
        headers: new Headers({
          'x-forwarded-host': 'localhost:3000',
          'x-forwarded-proto': 'http',
        }),
      })
    ).toBe('http://localhost:3000');

    expect(
      resolvePublicOrigin({
        url: 'http://127.0.0.1:3000/auth/callback',
        headers: new Headers({
          host: '127.0.0.1:3000',
        }),
      })
    ).toBe('http://127.0.0.1:3000');
  });

  it('rejette les en-têtes hôte malformés ou injectés et retombe sur url.origin', () => {
    expect(
      resolvePublicOrigin({
        url: 'https://vote.eatanddrinkcotonou.bj/auth/callback',
        headers: new Headers({
          'x-forwarded-host': 'evil.com/phish',
          'x-forwarded-proto': 'javascript',
        }),
      })
    ).toBe('https://vote.eatanddrinkcotonou.bj');

    expect(
      resolvePublicOrigin({
        url: 'https://vote.eatanddrinkcotonou.bj/auth/callback',
        headers: new Headers({
          'x-forwarded-host': 'user@evil.com',
        }),
      })
    ).toBe('https://vote.eatanddrinkcotonou.bj');
  });
});
