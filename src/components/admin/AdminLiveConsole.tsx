'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Award,
  Download,
  Edit3,
  Loader2,
  LogOut,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  SkipForward,
  Square,
} from 'lucide-react';
import { AdminDjFormPanel } from '@/components/admin/AdminDjFormModal';
import { AdminModerationPanel } from '@/components/admin/AdminModerationPanel';
import { useAdminLiveDashboard } from '@/hooks/useAdminLiveDashboard';
import { useAuthSession } from '@/hooks/useAuthSession';
import type { AdminPerformanceRankingRow, RoundStatus } from '@/types';

/**
 * Console complète de régie live et tableau de bord administrateur (FR-15 à FR-20).
 * Vérifie strictement le rôle (`super_admin` / `moderator`) avant tout affichage.
 */
export function AdminLiveConsole() {
  const auth = useAuthSession();
  const isAdmin =
    auth.status === 'success' &&
    (auth.role === 'super_admin' || auth.role === 'moderator');

  const dashboard = useAdminLiveDashboard(isAdmin);

  const [activeTab, setActiveTab] = useState<'regie' | 'djs' | 'moderation'>(
    'regie'
  );
  const [selectedRoundId, setSelectedRoundId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRow, setEditingRow] =
    useState<AdminPerformanceRankingRow | null>(null);

  const rounds = useMemo(() => dashboard.data?.rounds ?? [], [dashboard.data]);
  const activeRound = useMemo(() => {
    if (selectedRoundId) {
      return rounds.find((r) => r.id === selectedRoundId) ?? rounds[0] ?? null;
    }
    return rounds.find((r) => r.status === 'live') ?? rounds[0] ?? null;
  }, [rounds, selectedRoundId]);

  const roundRows = useMemo(() => {
    const all = dashboard.data?.rankings ?? [];
    const filteredByRound = activeRound
      ? all.filter((r) => r.roundId === activeRound.id)
      : all;

    if (!searchQuery.trim()) {
      return filteredByRound;
    }
    const q = searchQuery.trim().toLowerCase();
    return filteredByRound.filter(
      (r) =>
        r.stageName.toLowerCase().includes(q) ||
        (r.genre ?? '').toLowerCase().includes(q)
    );
  }, [dashboard.data, activeRound, searchQuery]);

  const openPerfInRound = useMemo(
    () => roundRows.find((r) => r.status === 'open') ?? null,
    [roundRows]
  );

  const nextWaitingPerf = useMemo(() => {
    const ordered = [...roundRows].sort(
      (a, b) => a.performanceOrder - b.performanceOrder
    );
    return ordered.find((r) => r.status === 'waiting') ?? null;
  }, [roundRows]);

  const sortedByRank = useMemo(
    () =>
      [...roundRows].sort((a, b) => {
        if (a.publicRank !== null && b.publicRank !== null) {
          return a.publicRank - b.publicRank;
        }
        if (a.publicRank !== null) return -1;
        if (b.publicRank !== null) return 1;
        return b.publicAvg - a.publicAvg;
      }),
    [roundRows]
  );

  // Vérification de rôle obligatoire (Règle 6)
  if (auth.status === 'loading') {
    return (
      <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl border border-white/15 bg-[#042812]/90 p-8 text-sm">
        <Loader2 className="h-5 w-5 animate-spin text-[#76E000]" />
        Vérification des droits administrateur...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-red-400/40 bg-[#042812]/95 p-6 text-center shadow-xl">
        <ShieldAlert className="mx-auto h-10 w-10 text-[#D9E81B]" />
        <h1 className="mt-3 text-lg font-black uppercase text-white">
          Accès réservé à la Régie
        </h1>
        <p className="mt-2 text-xs text-white/80">
          Connectez-vous avec un compte administrateur autorisé pour accéder au
          pilotage des passages et aux moyennes du public.
        </p>
        <Link
          href="/admin/login"
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#76E000] px-5 py-2.5 text-xs font-black uppercase text-[#063B1B]"
        >
          Connexion Administrateur
        </Link>
      </div>
    );
  }

  const handleMoveOrder = async (
    perfId: string,
    direction: 'up' | 'down'
  ) => {
    if (!activeRound) return;
    const ordered = [...roundRows].sort(
      (a, b) => a.performanceOrder - b.performanceOrder
    );
    const idx = ordered.findIndex((r) => r.performanceId === perfId);
    if (idx === -1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= ordered.length) return;

    const swapped = [...ordered];
    const currentItem = swapped[idx];
    const targetItem = swapped[targetIdx];
    if (!currentItem || !targetItem) return;

    swapped[idx] = targetItem;
    swapped[targetIdx] = currentItem;

    await dashboard.reorderPerformances(
      activeRound.id,
      swapped.map((s) => s.performanceId)
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-12">
      {/* Barre supérieure Régie */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-[#042812]/90 p-4 shadow-xl">
        <div>
          <p className="text-[11px] font-extrabold tracking-wider text-[#76E000] uppercase">
            Back-office Régie • Rôle : {auth.role}
          </p>
          <h1 className="text-lg font-black uppercase text-white sm:text-xl">
            Tableau de bord DJ Challenge
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/admin/export?type=results"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20"
          >
            <Download className="h-3.5 w-3.5" />
            Export Résultats CSV
          </a>
          <a
            href="/api/admin/export?type=audit"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20"
          >
            <Download className="h-3.5 w-3.5" />
            Export Audit CSV
          </a>
          <button
            type="button"
            onClick={() => void dashboard.refresh()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs font-bold hover:bg-black/50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync
          </button>
          <button
            type="button"
            onClick={() => void auth.signOut()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/30 bg-red-950/50 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-900/60"
          >
            <LogOut className="h-3.5 w-3.5" />
            Quitter
          </button>
        </div>
      </div>

      {/* Feedbacks & Alertes */}
      {dashboard.actionMessage ? (
        <div className="rounded-xl border border-[#76E000]/50 bg-[#09421A] px-4 py-2.5 text-xs font-bold text-[#76E000]">
          {dashboard.actionMessage}
        </div>
      ) : null}
      {dashboard.actionError || dashboard.error ? (
        <div className="rounded-xl border border-red-400/50 bg-red-950/70 px-4 py-2.5 text-xs font-bold text-red-200">
          {dashboard.actionError || dashboard.error}
        </div>
      ) : null}

      {/* Sélecteur de prime + Navigation onglets */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {rounds.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedRoundId(r.id)}
              className={`rounded-xl px-4 py-2 text-xs font-black uppercase transition ${
                activeRound?.id === r.id
                  ? 'bg-[#D9E81B] text-[#063B1B] shadow-md'
                  : 'border border-white/20 bg-black/30 text-white/80 hover:bg-black/50'
              }`}
            >
              {r.name} ({r.status})
            </button>
          ))}
        </div>

        <div className="flex rounded-xl border border-white/15 bg-black/35 p-1 text-xs font-bold">
          {(
            [
              { id: 'regie', label: 'Régie & Classement' },
              { id: 'djs', label: 'Gestion des DJ' },
              {
                id: 'moderation',
                label: `Anti-fraude (${dashboard.data?.fraudAlerts.length ?? 0})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === tab.id
                  ? 'bg-[#76E000] text-[#063B1B]'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {dashboard.status === 'loading' && !dashboard.data ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-[#042812]/80 p-10 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-[#76E000]" />
          Chargement des données temps réel...
        </div>
      ) : null}

      {/* ONGLET 1 : RÉGIE LIVE + CLASSEMENT TEMPS RÉEL */}
      {activeTab === 'regie' && dashboard.data ? (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Colonne gauche : Contrôle Régie Live & Ordre de passage */}
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-2xl border-2 border-[#76E000]/40 bg-[#042812]/90 p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-extrabold tracking-wider text-[#D9E81B] uppercase">
                    Passage actuellement ouvert au public
                  </p>
                  <h2 className="mt-1 text-xl font-black uppercase text-white">
                    {openPerfInRound
                      ? `#${openPerfInRound.performanceOrder} — ${openPerfInRound.stageName}`
                      : 'Aucun passage ouvert'}
                  </h2>
                  {openPerfInRound ? (
                    <p className="mt-1 text-xs text-[#76E000] font-bold">
                      {openPerfInRound.scoresCount} note(s) reçue(s) • Moyenne en
                      direct : {openPerfInRound.publicAvg.toFixed(2)} / 10
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {openPerfInRound ? (
                    <button
                      type="button"
                      onClick={() =>
                        void dashboard.controlPerformance(
                          openPerfInRound.performanceId,
                          'close'
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#8B1A1A] px-4 py-2.5 text-xs font-black uppercase text-white shadow hover:bg-red-700"
                    >
                      <Square className="h-3.5 w-3.5" />
                      Clôturer
                    </button>
                  ) : null}

                  {nextWaitingPerf ? (
                    <button
                      type="button"
                      onClick={() =>
                        void dashboard.controlPerformance(
                          nextWaitingPerf.performanceId,
                          'open'
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#76E000] px-4 py-2.5 text-xs font-black uppercase text-[#063B1B] shadow hover:bg-[#8ef31a]"
                    >
                      <SkipForward className="h-4 w-4" />
                      DJ suivant ({nextWaitingPerf.stageName})
                    </button>
                  ) : null}
                </div>
              </div>

              {activeRound ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3 text-xs">
                  <span className="font-bold text-white/75">Statut prime :</span>
                  {(['draft', 'scheduled', 'live', 'completed'] as RoundStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          void dashboard.updateRoundConfig(
                            activeRound.id,
                            st,
                            activeRound.minScoresRequired
                          )
                        }
                        className={`rounded-lg px-2.5 py-1 font-bold uppercase ${
                          activeRound.status === st
                            ? 'bg-white text-[#063B1B]'
                            : 'bg-white/10 text-white/75 hover:bg-white/20'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              ) : null}
            </div>

            {/* Liste ordonnée des passages */}
            <div className="rounded-2xl border border-white/15 bg-[#042812]/85 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-white/90">
                  Ordre de passage ({roundRows.length} DJ)
                </h3>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5 text-white/50" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un DJ..."
                    className="rounded-xl border border-white/15 bg-black/40 py-1.5 pr-3 pl-8 text-xs text-white placeholder:text-white/40 focus:border-[#76E000] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                {[...roundRows]
                  .sort((a, b) => a.performanceOrder - b.performanceOrder)
                  .map((row) => (
                    <div
                      key={row.performanceId}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-xs ${
                        row.status === 'open'
                          ? 'border-[#76E000] bg-[#09421A]'
                          : 'border-white/10 bg-black/30'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 font-black text-[#D9E81B]">
                          #{row.performanceOrder}
                        </span>
                        <div>
                          <p className="font-black text-white uppercase">
                            {row.stageName}
                          </p>
                          <p className="text-[11px] text-white/65">
                            {row.status === 'open'
                              ? 'EN DIRECT'
                              : row.status === 'closed'
                                ? 'Clôturé'
                                : 'En attente'}{' '}
                            • {row.scoresCount} note(s) • Moy.{' '}
                            {row.publicAvg.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          title="Monter"
                          onClick={() =>
                            void handleMoveOrder(row.performanceId, 'up')
                          }
                          className="rounded-lg border border-white/15 bg-white/5 p-1.5 hover:bg-white/15"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Descendre"
                          onClick={() =>
                            void handleMoveOrder(row.performanceId, 'down')
                          }
                          className="rounded-lg border border-white/15 bg-white/5 p-1.5 hover:bg-white/15"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>

                        {row.status !== 'open' ? (
                          <button
                            type="button"
                            onClick={() =>
                              void dashboard.controlPerformance(
                                row.performanceId,
                                'open'
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-[#76E000] px-2.5 py-1.5 font-black text-[#063B1B]"
                          >
                            <Play className="h-3 w-3" />
                            Lancer
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              void dashboard.controlPerformance(
                                row.performanceId,
                                'close'
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-[#8B1A1A] px-2.5 py-1.5 font-black text-white"
                          >
                            <Square className="h-3 w-3" />
                            Clôturer
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Colonne droite : Classement du public temps réel + Qualifiés + Alertes */}
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-2xl border border-white/15 bg-[#042812]/90 p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-black tracking-wider text-[#D9E81B] uppercase">
                  Classement Public (Admins uniquement)
                </h3>
                <span className="text-[11px] font-bold text-white/70">
                  {dashboard.data.totalValidScores} notes valides
                </span>
              </div>

              <div className="space-y-2">
                {sortedByRank.map((row) => (
                  <div
                    key={row.performanceId}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 text-center font-black text-[#D9E81B]">
                        {row.publicRank !== null ? `#${row.publicRank}` : '—'}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-black text-white uppercase">
                          {row.stageName}
                        </p>
                        <p className="text-[11px] text-white/65">
                          {row.scoresCount} vote(s)
                          {!row.meetsMinThreshold
                            ? ` (min ${row.minScoresRequired})`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-lg bg-[#09421A] px-2.5 py-1 font-black text-[#76E000]">
                        {row.publicAvg.toFixed(2)}/10
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          void dashboard.toggleQualified(
                            row.performanceId,
                            !row.isQualified
                          )
                        }
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition ${
                          row.isQualified
                            ? 'bg-[#D9E81B] text-[#063B1B]'
                            : 'border border-white/20 bg-white/5 text-white/75 hover:bg-white/15'
                        }`}
                      >
                        <Award className="h-3.5 w-3.5" />
                        {row.isQualified ? 'Qualifié' : 'Qualifier'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alertes anti-fraude temps réel */}
            <div className="rounded-2xl border border-white/15 bg-[#042812]/85 p-4">
              <h3 className="mb-2.5 flex items-center gap-2 text-xs font-black uppercase text-[#D9E81B]">
                <AlertTriangle className="h-4 w-4" />
                Alertes fraude récentes ({dashboard.data.fraudAlerts.length})
              </h3>
              {dashboard.data.fraudAlerts.length === 0 ? (
                <p className="text-xs text-white/65">
                  Aucune anomalie détectée pour le moment.
                </p>
              ) : (
                <ul className="space-y-2 max-h-56 overflow-y-auto text-xs">
                  {dashboard.data.fraudAlerts.map((al) => (
                    <li
                      key={al.id}
                      className="rounded-xl border border-red-400/25 bg-red-950/35 p-2.5"
                    >
                      <p className="font-bold text-red-200">{al.title}</p>
                      <p className="text-[11px] text-white/75">
                        {al.description}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ONGLET 2 : GESTION DES DJ (AJOUT RAPIDE, IMPORT CSV, MODIFICATION) */}
      {activeTab === 'djs' && dashboard.data ? (
        <div className="space-y-5">
          <AdminDjFormPanel
            key={editingRow?.djId ?? 'new-dj'}
            rounds={rounds}
            editingRow={editingRow}
            onCancelEdit={() => setEditingRow(null)}
            onCreateDj={dashboard.createDj}
            onUpdateDj={dashboard.updateDj}
            onImportCsv={dashboard.importDjsCsv}
          />

          <div className="rounded-2xl border border-white/15 bg-[#042812]/85 p-4">
            <h3 className="mb-3 text-xs font-black uppercase text-white/90">
              Tous les DJ enregistrés ({dashboard.data.rankings.length})
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {dashboard.data.rankings.map((row) => (
                <div
                  key={row.djId}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 p-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-black text-[#D9E81B] uppercase">
                      {row.stageName}
                    </p>
                    <p className="text-[11px] text-white/70">
                      {row.roundName} • Passage #{row.performanceOrder} (
                      {row.status})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingRow(row)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 font-bold hover:bg-white/20"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Modifier
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* ONGLET 3 : MODÉRATION & INVALIDATION */}
      {activeTab === 'moderation' ? (
        <AdminModerationPanel enabled={isAdmin} />
      ) : null}
    </div>
  );
}

