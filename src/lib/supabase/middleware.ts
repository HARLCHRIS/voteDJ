import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { resolvePublicOrigin } from '@/lib/supabase/origin';
import type { Database } from '@/types';

/**
 * Rafraîchit la session Supabase et protège les routes `/admin` (hors `/admin/login`)
 * en vérifiant côté serveur la présence de l'utilisateur dans `admin_users`.
 */
export async function updateSessionAndGuardRoutes(
  request: NextRequest
): Promise<NextResponse> {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !url ||
    !anonKey ||
    url.includes('your-project-ref') ||
    anonKey.includes('your-anon-key')
  ) {
    return response;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publicOrigin = resolvePublicOrigin(request);
  const pathname = request.nextUrl.pathname;
  const oauthError = request.nextUrl.searchParams.get('error');
  const oauthErrorCode = request.nextUrl.searchParams.get('error_code');

  // Si Supabase redirige vers la racine (Site URL) suite à une erreur OAuth, renvoyer vers /vote
  if (
    pathname === '/' &&
    (Boolean(oauthErrorCode) || (Boolean(oauthError) && oauthError !== 'forbidden'))
  ) {
    const voteErrorUrl = new URL('/vote', publicOrigin);
    voteErrorUrl.searchParams.set(
      'auth_error',
      oauthError === 'access_denied'
        ? 'access_denied'
        : oauthErrorCode || oauthError || 'google_callback'
    );
    return NextResponse.redirect(voteErrorUrl);
  }

  const isAdminRoute = pathname.startsWith('/admin');
  const isAdminLoginRoute = pathname === '/admin/login';

  if (isAdminRoute && !isAdminLoginRoute) {
    if (!user) {
      const loginUrl = new URL('/admin/login', publicOrigin);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const { data: adminRecord } = await supabase
      .from('admin_users')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!adminRecord) {
      return NextResponse.redirect(new URL('/?error=forbidden', publicOrigin));
    }
  }

  return response;
}

