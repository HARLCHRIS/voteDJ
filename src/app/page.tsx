import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Disc3, Radio, Trophy } from 'lucide-react';
import { CheckmarkBadge3D } from '@/components/shared/CheckmarkBadge3D';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const revalidate = 10;

interface PublicRoundView {
  id: string;
  name: string;
  orderNumber: number;
  status: string;
  djs: Array<{
    performanceId: string;
    stageName: string;
    genre: string | null;
    status: string;
    isQualified: boolean;
  }>;
}

/**
 * Charge les données publiques des primes et des DJ sans jamais exposer les scores.
 */
async function loadPublicProgram(): Promise<{
  rounds: PublicRoundView[];
}> {
  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) {
    return {
      rounds: [
        { id: 'p1', name: 'Prime 1', orderNumber: 1, status: 'scheduled', djs: [] },
        { id: 'p2', name: 'Prime 2', orderNumber: 2, status: 'draft', djs: [] },
      ],
    };
  }

  const [{ data: roundRows }, { data: perfRows }, { data: djRows }] =
    await Promise.all([
      serviceClient
        .from('rounds')
        .select('id, name, order_number, status')
        .order('order_number', { ascending: true }),
      serviceClient
        .from('performances')
        .select('id, round_id, dj_id, performance_order, status, is_qualified')
        .order('performance_order', { ascending: true }),
      serviceClient.from('djs').select('id, stage_name, genre'),
    ]);

  const djMap = new Map((djRows ?? []).map((d) => [d.id, d]));
  const rounds: PublicRoundView[] = (roundRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    orderNumber: r.order_number,
    status: r.status,
    djs: (perfRows ?? [])
      .filter((p) => p.round_id === r.id)
      .map((p) => {
        const dj = djMap.get(p.dj_id);
        return {
          performanceId: p.id,
          stageName: dj?.stage_name ?? 'DJ',
          genre: dj?.genre ?? null,
          status: p.status,
          isQualified: p.is_qualified,
        };
      }),
  }));

  return {
    rounds,
  };
}

/**
 * Page d'accueil publique (FR-1) : met en valeur les deux logos du festival,
 * la prime en cours, la liste des DJ par prime et l'accès direct au vote.
 */
export default async function HomePage() {
  const { rounds } = await loadPublicProgram();
  const visibleRounds = rounds.filter((r) => r.status !== 'draft');

  return (
    <div className="min-h-screen pt-6 pb-14 sm:pt-10">
      <main className="mx-auto w-full max-w-5xl space-y-8 px-4">
        {/* Hero inspiré de l'affiche VOTE */}
        <section className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-[#0E6B32]/90 via-[#094F24]/95 to-[#052E15] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -bottom-8 -rotate-6 select-none text-[8rem] font-black leading-none tracking-tighter text-white/10 sm:text-[12rem]"
          >
            VOTE
          </div>

          <div className="relative z-10 grid items-center gap-8 md:grid-cols-12">
            <div className="md:col-span-7 space-y-4">
              <h1 className="text-3xl font-black leading-[1.05] tracking-tight uppercase sm:text-5xl">
                DJ Challenge{' '}
                <span className="text-[#D9E81B]">Days Party</span>
              </h1>

              <p className="max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
                Notez en direct chaque DJ pendant son passage sur scène lors des
                deux primes de sélection pour le line-up officiel du{' '}
                <strong className="text-white">
                  Eat &amp; Drink Festival Cotonou 2027
                </strong>
                .
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/vote"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#76E000] px-6 py-3.5 text-sm font-black uppercase text-[#063B1B] shadow-[0_6px_0_#117A22] transition hover:bg-[#8ef31a] active:translate-y-0.5"
                >
                  <Radio className="h-4 w-4" />
                  Accéder au vote en direct
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href="/qualifies"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-black/30 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-black/45"
                >
                  <Trophy className="h-4 w-4 text-[#D9E81B]" />
                  Voir les qualifiés
                </Link>
              </div>
            </div>

            {/* Mise en scène des 2 logos officiels */}
            <div className="relative flex items-center justify-center gap-4 md:col-span-5">
              <div className="relative h-40 w-40 rounded-3xl border-2 border-white/25 bg-white p-2 shadow-2xl sm:h-44 sm:w-44">
                <Image
                  src="/images/logo-eat-drink-2027.png"
                  alt="Eat & Drink Festival 2027 Toucan"
                  fill
                  sizes="176px"
                  className="object-contain p-2"
                  priority
                />
              </div>
              <div className="relative -ml-8 mt-10 h-36 w-36 rounded-full border-4 border-[#76E000] bg-black p-2 shadow-2xl sm:h-40 sm:w-40">
                <Image
                  src="/images/logo-days-party.png"
                  alt="Days Party Vinyl"
                  fill
                  sizes="160px"
                  className="object-contain p-1"
                  priority
                />
              </div>
              <div className="absolute -top-3 right-2">
                <CheckmarkBadge3D size="md" />
              </div>
            </div>
          </div>
        </section>

        {/* Primes publiées et DJ engagés (les primes en brouillon restent masquées) */}
        <section
          className={
            visibleRounds.length > 1 ? 'grid gap-5 md:grid-cols-2' : 'grid gap-5'
          }
        >
          {visibleRounds.map((round) => (
            <div
              key={round.id}
              className="rounded-2xl border border-white/15 bg-[#042812]/85 p-5 shadow-xl"
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                <h2 className="text-lg font-black tracking-wide text-[#D9E81B] uppercase">
                  {round.name}
                </h2>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase text-white">
                  {round.status === 'live'
                    ? 'En direct'
                    : round.status === 'completed'
                      ? 'Terminée'
                      : round.status === 'scheduled'
                        ? 'À venir'
                        : 'En préparation'}
                </span>
              </div>

              {round.djs.length === 0 ? (
                <p className="mt-4 text-xs text-white/70">
                  La liste des DJ pour {round.name} sera publiée très
                  prochainement par l’organisation.
                </p>
              ) : (
                <ul
                  className={
                    visibleRounds.length === 1
                      ? 'mt-3 grid gap-2 sm:grid-cols-2'
                      : 'mt-3 space-y-2'
                  }
                >
                  {round.djs.map((dj, index) => (
                    <li
                      key={dj.performanceId}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-black text-[#76E000]">
                          #{String(index + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <p className="font-extrabold text-white uppercase">
                            {dj.stageName}
                          </p>
                          {dj.genre ? (
                            <p className="text-[11px] text-white/60">
                              {dj.genre}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {dj.status === 'open' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#76E000] px-2.5 py-0.5 text-[10px] font-black text-[#063B1B] uppercase">
                          <Disc3 className="h-3 w-3 animate-spin" />
                          Sur scène
                        </span>
                      ) : dj.isQualified ? (
                        <span className="rounded-full bg-[#D9E81B] px-2.5 py-0.5 text-[10px] font-black text-[#063B1B] uppercase">
                          Qualifié
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

