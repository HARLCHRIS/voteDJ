import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types';

let browserClient: SupabaseClient<Database> | null = null;

/**
 * Retourne un client Supabase singleton côté navigateur typé avec `Database`.
 * Retourne `null` si les variables d'environnement publiques ne sont pas encore configurées.
 */
export function createSupabaseBrowserClient(): SupabaseClient<Database> | null {
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

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(url, anonKey);
  }

  return browserClient;
}

