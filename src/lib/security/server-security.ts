import crypto from 'node:crypto';

export const DEVICE_COOKIE_NAME = 'dj_device_token';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, RateLimitBucket>();

/**
 * Hache une donnée sensible (jeton d'appareil, empreinte ou IP) en SHA-256 salé.
 * Aucune valeur brute d'IP ou de jeton d'appareil n'est stockée en base.
 */
export function hashWithSalt(rawValue: string): string {
  const salt =
    process.env.DEVICE_HASH_SALT || 'dev-only-dj-challenge-salt-change-in-prod';
  return crypto.createHmac('sha256', salt).update(rawValue).digest('hex');
}

/**
 * Extrait l'adresse IP probable du client depuis les en-têtes de la requête.
 */
export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }
  return headers.get('x-real-ip') || '127.0.0.1';
}

/**
 * Vérifie le jeton Cloudflare Turnstile côté serveur.
 * Si `TURNSTILE_SECRET_KEY` n'est pas configuré en environnement local, autorise la requête.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string
): Promise<{ success: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { success: true };
  }

  if (!token) {
    return {
      success: false,
      error: 'Vérification anti-robot manquante. Rechargez la page.',
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.set('secret', secret);
    formData.set('response', token);
    if (remoteIp) {
      formData.set('remoteip', remoteIp);
    }

    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      }
    );

    const payload = (await res.json()) as { success?: boolean };
    if (!payload.success) {
      return {
        success: false,
        error: 'Échec de la vérification anti-robot. Veuillez réessayer.',
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: 'Impossible de joindre le service anti-robot.',
    };
  }
}

/**
 * Applique une limitation de débit (Rate Limiting) par clé (compte, IP, appareil).
 * Utilise Upstash Redis REST si configuré, sinon un compteur en mémoire locale.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashSecret = process.env.UPSTASH_REDIS_REST_SECRET;

  if (upstashUrl && upstashSecret) {
    try {
      const redisKey = `ratelimit:${key}`;
      const incrRes = await fetch(`${upstashUrl}/incr/${encodeURIComponent(redisKey)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${upstashSecret}` },
      });
      const incrData = (await incrRes.json()) as { result?: number };
      const currentCount = incrData.result ?? 1;

      if (currentCount === 1) {
        await fetch(
          `${upstashUrl}/expire/${encodeURIComponent(redisKey)}/${windowSeconds}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${upstashSecret}` },
          }
        );
      }

      return {
        allowed: currentCount <= maxRequests,
        remaining: Math.max(0, maxRequests - currentCount),
      };
    } catch {
      // Bascule vers le fallback en mémoire si Upstash est momentanément indisponible
    }
  }

  const now = Date.now();
  const existing = memoryBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    });
    return { allowed: true, remaining: Math.max(0, maxRequests - 1) };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= maxRequests,
    remaining: Math.max(0, maxRequests - existing.count),
  };
}

