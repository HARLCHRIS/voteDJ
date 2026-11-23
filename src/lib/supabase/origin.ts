/**
 * Représentation minimale d'une requête HTTP nécessaire pour résoudre
 * son origine publique (compatible NextRequest et Request standard).
 */
export interface PublicOriginRequestLike {
  url: string;
  headers: Pick<Headers, 'get'>;
}

const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
]);

function isLocalHost(host: string): boolean {
  const normalized = host.toLowerCase();
  for (const local of LOCAL_HOSTNAMES) {
    if (normalized === local || normalized.startsWith(`${local}:`)) {
      return true;
    }
  }
  return false;
}

/**
 * Détermine l'origine publique réelle de la requête derrière un proxy (Vercel)
 * afin d'éviter toute redirection vers une origine interne ou localhost.
 */
export function resolvePublicOrigin(request: PublicOriginRequestLike): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const hostHeader = forwardedHost || request.headers.get('host');
  const cleanHost = hostHeader?.split(',')[0]?.trim();

  if (
    cleanHost &&
    !cleanHost.includes('/') &&
    !cleanHost.includes('@') &&
    !isLocalHost(cleanHost)
  ) {
    const protoHeader = request.headers.get('x-forwarded-proto');
    const rawProto = protoHeader?.split(',')[0]?.trim().toLowerCase();
    const cleanProto =
      rawProto === 'http' || rawProto === 'https' ? rawProto : 'https';

    try {
      return new URL(`${cleanProto}://${cleanHost}`).origin;
    } catch {
      return url.origin;
    }
  }

  return url.origin;
}
