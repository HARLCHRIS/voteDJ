import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from '@/lib/supabase/server';
import type { AdminRole, Database } from '@/types';

export interface VerifiedAdminContext {
  serviceClient: SupabaseClient<Database>;
  userClient: SupabaseClient<Database>;
  authUserId: string;
  adminId: string;
  role: AdminRole;
}

/**
 * Recherche un compte administrateur dans `admin_users` à partir de `auth_user_id`.
 * Permet de partager la vérification de rôle entre `requireAdminSession`
 * et les endpoints publics qui doivent exclure toute session Régie.
 */
export async function getAdminAccountByAuthUserId(
  serviceClient: SupabaseClient<Database>,
  authUserId: string
): Promise<{ admin: { id: string; role: AdminRole } | null; error: boolean }> {
  const { data, error } = await serviceClient
    .from('admin_users')
    .select('id, role')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) {
    return { admin: null, error: true };
  }

  return { admin: data, error: false };
}

/**
 * Vérifie côté serveur que l'utilisateur courant est authentifié ET présent dans `admin_users`.
 * Retourne soit le contexte administrateur vérifié, soit une réponse HTTP 401/403/503 prête à renvoyer.
 */
export async function requireAdminSession(): Promise<
  | { ok: true; context: VerifiedAdminContext }
  | { ok: false; response: NextResponse }
> {
  const userClient = await createSupabaseServerClient();
  const serviceClient = createSupabaseServiceClient();

  if (!userClient || !serviceClient) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            'Supabase n’est pas encore configuré (.env.local manquant).',
        },
        { status: 503 }
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Authentification administrateur requise.' },
        { status: 401 }
      ),
    };
  }

  const { admin: adminRecord, error: adminError } =
    await getAdminAccountByAuthUserId(serviceClient, user.id);

  if (adminError || !adminRecord) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Accès interdit : droits administrateur insuffisants.' },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    context: {
      serviceClient,
      userClient,
      authUserId: user.id,
      adminId: adminRecord.id,
      role: adminRecord.role,
    },
  };
}

