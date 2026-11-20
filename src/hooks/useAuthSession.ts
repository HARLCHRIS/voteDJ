'use client';

import { useCallback, useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AuthSessionState, UserRole } from '@/types';

const INITIAL_STATE: AuthSessionState = {
  status: 'loading',
  userId: null,
  role: 'visitor',
  isAuthenticated: false,
  displayName: null,
  error: null,
};

/**
 * Hook de gestion de session et de vérification du rôle utilisateur
 * (`super_admin`, `moderator`, `voter` ou `visitor`).
 * Gère les 3 états : loading / success / error.
 */
export function useAuthSession() {
  const [state, setState] = useState<AuthSessionState>(INITIAL_STATE);

  const refreshSession = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setState({
        status: 'success',
        userId: null,
        role: 'visitor',
        isAuthenticated: false,
        displayName: null,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        // Absence de session active ne constitue pas une erreur bloquante pour un visiteur
        setState({
          status: 'success',
          userId: null,
          role: 'visitor',
          isAuthenticated: false,
          displayName: null,
          error: null,
        });
        return;
      }

      if (!user) {
        setState({
          status: 'success',
          userId: null,
          role: 'visitor',
          isAuthenticated: false,
          displayName: null,
          error: null,
        });
        return;
      }

      const { data: adminRow, error: adminError } = await supabase
        .from('admin_users')
        .select('role, display_name')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (adminError) {
        throw new Error('Impossible de vérifier le rôle de la session.');
      }

      let role: UserRole = 'voter';
      let displayName: string | null =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null;

      if (adminRow) {
        role = adminRow.role;
        displayName = adminRow.display_name ?? displayName ?? 'Administrateur';
      }

      setState({
        status: 'success',
        userId: user.id,
        role,
        isAuthenticated: true,
        displayName,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur de vérification de session.';
      setState({
        status: 'error',
        userId: null,
        role: 'visitor',
        isAuthenticated: false,
        displayName: null,
        error: message,
      });
    }
  }, []);

  useEffect(() => {
    void refreshSession();

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshSession();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshSession]);

  /**
   * Lance la connexion OAuth Google (scopes de base uniquement) pour les votants.
   */
  const signInWithGoogle = useCallback(async (redirectPath = '/vote') => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error:
          'Supabase n’est pas encore configuré. Ajoutez les clés dans .env.local.',
      }));
      return;
    }

    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectPath)}`,
        scopes: 'openid email profile',
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error.message,
      }));
    }
  }, []);

  /**
   * Déconnecte l'utilisateur courant.
   */
  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    await refreshSession();
  }, [refreshSession]);

  return {
    ...state,
    refreshSession,
    signInWithGoogle,
    signOut,
  };
}

