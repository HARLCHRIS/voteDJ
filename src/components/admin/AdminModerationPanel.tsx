'use client';

import { useState } from 'react';
import { Ban, CheckCircle, Loader2, RefreshCw, Smartphone, Unlink } from 'lucide-react';
import { useAdminModeration } from '@/hooks/useAdminModeration';

interface AdminModerationPanelProps {
  enabled: boolean;
}

/**
 * Panneau de modération anti-fraude : gestion des appareils liés (déliaison, blocage)
 * et invalidation motivée des notes suspectes (FR-14, FR-20).
 */
export function AdminModerationPanel({ enabled }: AdminModerationPanelProps) {
  const {
    status,
    data,
    error,
    feedback,
    refresh,
    invalidateScore,
    manageDeviceOrVoter,
  } = useAdminModeration(enabled);

  const [reasonByScore, setReasonByScore] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const handleInvalidate = async (scoreId: string) => {
    const reason = (reasonByScore[scoreId] ?? '').trim();
    if (reason.length < 3) {
      setActionError('Saisissez un motif obligatoire (3 caractères minimum).');
      return;
    }
    setActionError(null);
    try {
      await invalidateScore(scoreId, reason);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Erreur lors de l’invalidation.'
      );
    }
  };

  if (status === 'loading' && !data) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-[#042812]/80 p-5 text-sm text-white/80">
        <Loader2 className="h-4 w-4 animate-spin text-[#76E000]" />
        Chargement de la console anti-fraude...
      </div>
    );
  }

  if (status === 'error' && error) {
    return (
      <div className="rounded-2xl border border-red-400/40 bg-red-950/60 p-4 text-sm text-red-100">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black tracking-wide text-[#D9E81B] uppercase">
          Modération Appareils &amp; Notes
        </h3>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </button>
      </div>

      {feedback ? (
        <p className="rounded-xl border border-[#76E000]/40 bg-[#09421A] px-3 py-2 text-xs font-bold text-[#76E000]">
          {feedback}
        </p>
      ) : null}

      {actionError ? (
        <p className="rounded-xl border border-red-400/40 bg-red-950/60 px-3 py-2 text-xs font-bold text-red-200">
          {actionError}
        </p>
      ) : null}

      {/* Appareils liés */}
      <div className="rounded-2xl border border-white/15 bg-[#042812]/85 p-4">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase text-white/90">
          <Smartphone className="h-4 w-4 text-[#76E000]" />
          Appareils enregistrés ({data?.devices.length ?? 0})
        </h4>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {(data?.devices ?? []).map((dev) => (
            <div
              key={dev.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 p-3 text-xs"
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white">
                  Appareil #{dev.id.slice(0, 8)} •{' '}
                  <span
                    className={
                      dev.status === 'blocked'
                        ? 'text-red-400'
                        : dev.status === 'flagged'
                          ? 'text-[#D9E81B]'
                          : 'text-[#76E000]'
                    }
                  >
                    {dev.status.toUpperCase()}
                  </span>
                  {dev.unlinkedAt ? ' (DÉLIÉ)' : ''}
                </p>
                <p className="truncate text-[11px] text-white/60">
                  {dev.scoresCount} note(s) • {dev.userAgent ?? 'Navigateur inconnu'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {!dev.unlinkedAt ? (
                  <button
                    type="button"
                    onClick={() =>
                      void manageDeviceOrVoter({
                        action: 'unlink_device',
                        deviceId: dev.id,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-bold hover:bg-white/20"
                  >
                    <Unlink className="h-3 w-3" />
                    Délier
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() =>
                    void manageDeviceOrVoter({
                      action:
                        dev.status === 'blocked'
                          ? 'unblock_device'
                          : 'block_device',
                      deviceId: dev.id,
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 bg-red-950/50 px-2.5 py-1 text-[11px] font-bold text-red-200 hover:bg-red-900/60"
                >
                  {dev.status === 'blocked' ? (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      Débloquer
                    </>
                  ) : (
                    <>
                      <Ban className="h-3 w-3" />
                      Bloquer
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes récentes + Invalidation motivée */}
      <div className="rounded-2xl border border-white/15 bg-[#042812]/85 p-4">
        <h4 className="mb-3 text-xs font-extrabold uppercase text-white/90">
          Dernières notes enregistrées ({data?.recentScores.length ?? 0})
        </h4>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {(data?.recentScores ?? []).map((sc) => (
            <div
              key={sc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 p-3 text-xs"
            >
              <div>
                <p className="font-bold text-white">
                  {sc.djStageName} —{' '}
                  <span className="text-[#D9E81B]">{sc.score}/10</span>{' '}
                  {!sc.isValid ? (
                    <span className="ml-1 rounded bg-red-900/70 px-1.5 py-0.5 text-[10px] text-red-200">
                      INVALIDÉE ({sc.invalidatedReason})
                    </span>
                  ) : null}
                </p>
                <p className="text-[11px] text-white/60">
                  Votant #{sc.voterId.slice(0, 8)} •{' '}
                  {new Date(sc.createdAt).toLocaleTimeString('fr-FR')}
                </p>
              </div>

              {sc.isValid ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Motif obligatoire..."
                    value={reasonByScore[sc.id] ?? ''}
                    onChange={(e) =>
                      setReasonByScore((prev) => ({
                        ...prev,
                        [sc.id]: e.target.value,
                      }))
                    }
                    className="w-40 rounded-lg border border-white/20 bg-black/50 px-2 py-1 text-[11px] text-white placeholder:text-white/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleInvalidate(sc.id)}
                    className="rounded-lg bg-[#8B1A1A] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700"
                  >
                    Invalider
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

