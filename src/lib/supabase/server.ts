import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types';

/**
 * Crée un client Supabase côté serveur (Server Components / Route Handlers)
 * lié aux cookies de session de la requête courante.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient<Database> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !url ||
    !anonKey ||
    url.includes('your-project-ref') ||
    anonKey.includes('your-anon-key')
  ) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignoré lors d'un appel depuis un Server Component en lecture seule
        }
      },
    },
  });
}

/**
 * Crée un client Supabase avec privilèges `service_role` strictement côté serveur.
 * Ne doit jamais être importé ni exécuté dans un composant client.
 */
export function createSupabaseServiceClient(): SupabaseClient<Database> | null {
  if (typeof window !== 'undefined') {
    throw new Error('createSupabaseServiceClient ne peut pas être exécuté côté client.');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !url ||
    !serviceRoleKey ||
    url.includes('your-project-ref') ||
    serviceRoleKey.includes('your-service-role-key')
  ) {
    return null;
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

