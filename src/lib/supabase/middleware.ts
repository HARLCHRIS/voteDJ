import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
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

  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith('/admin');
  const isAdminLoginRoute = pathname === '/admin/login';

  if (isAdminRoute && !isAdminLoginRoute) {
    if (!user) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const { data: adminRecord } = await supabase
      .from('admin_users')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!adminRecord) {
      return NextResponse.redirect(new URL('/?error=forbidden', request.url));
    }
  }

  return response;
}

