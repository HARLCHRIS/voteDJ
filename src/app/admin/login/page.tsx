'use client';

import { useState } from 'react';
import { Loader2, LockKeyhole } from 'lucide-react';
import { FestivalHeader } from '@/components/shared/FestivalHeader';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Page de connexion administrateur (email + mot de passe).
 * Utilise une navigation complète (`window.location.assign`) après authentification
 * pour éviter tout cache de redirection `307` préchargé par le routeur Next.js.
 */
export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setStatus('error');
      setError(
        'Supabase n’est pas encore configuré. Renseignez .env.local pour vous connecter.'
      );
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setStatus('error');
        setError('Identifiants administrateur invalides.');
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const nextParam = params.get('next');
      const targetPath =
        nextParam && nextParam.startsWith('/admin') && !nextParam.startsWith('/admin/login')
          ? nextParam
          : '/admin';

      window.location.assign(targetPath);
    } catch {
      setStatus('error');
      setError('Erreur réseau lors de la connexion. Réessayez.');
    }
  };

  return (
    <div className="min-h-screen pb-14">
      <FestivalHeader />

      <main className="mx-auto mt-8 w-full max-w-md px-4">
        <div className="rounded-3xl border border-white/20 bg-[#042812]/90 p-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#76E000] text-[#063B1B]">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase text-white">
                Connexion Régie
              </h1>
              <p className="text-xs text-white/75">
                Accès réservé à l’organisation du DJ Challenge
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-white/85">
                Adresse email
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="regie@eatanddrinkcotonou.com"
                className="w-full rounded-xl border border-white/20 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-[#76E000] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-white/85">
                Mot de passe
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-[#76E000] focus:outline-none"
              />
            </div>

            {status === 'error' && error ? (
              <p
                role="alert"
                className="rounded-xl border border-red-400/40 bg-red-950/60 px-3 py-2 text-xs font-bold text-red-200"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#76E000] px-4 py-3 text-sm font-black uppercase text-[#063B1B] shadow-md transition hover:bg-[#8ef31a] disabled:opacity-50"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                'Accéder à la régie'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
