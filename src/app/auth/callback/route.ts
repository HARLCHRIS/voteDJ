import { NextResponse, type NextRequest } from 'next/server';
import { resolvePublicOrigin } from '@/lib/supabase/origin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Callback OAuth Google (Supabase Auth) : échange le `code` contre une session
 * puis redirige vers la page de vote `/vote` (ou `next`).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const publicOrigin = resolvePublicOrigin(request);
  const code = searchParams.get('code');
  const rawError = searchParams.get('error');
  const rawErrorCode = searchParams.get('error_code');
  const oauthError =
    rawError === 'access_denied' ? 'access_denied' : rawErrorCode || rawError;
  const next = searchParams.get('next') || '/vote';
  const safeNext =
    next.startsWith('/') && !next.startsWith('//') ? next : '/vote';

  if (oauthError) {
    return NextResponse.redirect(
      `${publicOrigin}/vote?auth_error=${encodeURIComponent(oauthError)}`
    );
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${publicOrigin}${safeNext}`);
      }
    }
  }

  return NextResponse.redirect(`${publicOrigin}/vote?auth_error=google_callback`);
}

