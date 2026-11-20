import Link from 'next/link';
import { Award, Radio } from 'lucide-react';
import { CheckmarkBadge3D } from '@/components/shared/CheckmarkBadge3D';
import { FestivalHeader } from '@/components/shared/FestivalHeader';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const revalidate = 15;

interface QualifiedDjGroup {
  roundName: string;
  djs: Array<{
    performanceId: string;
    stageName: string;
    genre: string | null;
  }>;
}

/**
 * Charge uniquement les DJ marqués qualifiés par l'admin (sans aucun score ni rang).
 */
async function loadQualifiedDjs(): Promise<QualifiedDjGroup[]> {
  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) {
    return [
      { roundName: 'Prime 1', djs: [] },
      { roundName: 'Prime 2', djs: [] },
    ];
  }

  const [{ data: rounds }, { data: perfs }, { data: djs }] = await Promise.all([
    serviceClient
      .from('rounds')
      .select('id, name, order_number')
      .order('order_number', { ascending: true }),
    serviceClient
      .from('performances')
      .select('id, round_id, dj_id, performance_order, is_qualified')
      .eq('is_qualified', true)
      .order('performance_order', { ascending: true }),
    serviceClient.from('djs').select('id, stage_name, genre'),
  ]);

  const djMap = new Map((djs ?? []).map((d) => [d.id, d]));

  return (rounds ?? []).map((r) => ({
    roundName: r.name,
    djs: (perfs ?? [])
      .filter((p) => p.round_id === r.id)
      .map((p) => {
        const dj = djMap.get(p.dj_id);
        return {
          performanceId: p.id,
          stageName: dj?.stage_name ?? 'DJ',
          genre: dj?.genre ?? null,
        };
      }),
  }));
}

/**
 * Page publique des DJ qualifiés par prime (FR-6).
 * Aucun résultat numérique ou classement n'est affiché au public.
 */
export default async function QualifiesPage() {
  const groups = await loadQualifiedDjs();

  return (
    <div className="min-h-screen pb-14">
      <FestivalHeader />

      <main className="mx-auto mt-4 w-full max-w-4xl space-y-6 px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/15 bg-[#042812]/90 p-6 shadow-xl">
          <div>
            <p className="text-xs font-extrabold tracking-wider text-[#76E000] uppercase">
              Sélection Officielle
            </p>
            <h1 className="mt-1 text-2xl font-black uppercase text-white sm:text-3xl">
              DJ Qualifiés
            </h1>
            <p className="mt-1 text-xs text-white/80">
              Liste officielle des DJ retenus à l’issue des délibérations (public
              + jury).
            </p>
          </div>
          <Link
            href="/vote"
            className="inline-flex items-center gap-2 rounded-xl bg-[#76E000] px-4 py-2.5 text-xs font-black uppercase text-[#063B1B]"
          >
            <Radio className="h-4 w-4" />
            Aller au vote
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {groups.map((group) => (
            <section
              key={group.roundName}
              className="rounded-2xl border border-white/15 bg-[#042812]/85 p-5 shadow-xl"
            >
              <h2 className="flex items-center gap-2 border-b border-white/10 pb-3 text-lg font-black text-[#D9E81B] uppercase">
                <Award className="h-5 w-5 text-[#76E000]" />
                {group.roundName}
              </h2>

              {group.djs.length === 0 ? (
                <p className="mt-4 text-xs text-white/70">
                  Les qualifiés de {group.roundName} seront annoncés après la
                  délibération du jury.
                </p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {group.djs.map((dj) => (
                    <li
                      key={dj.performanceId}
                      className="flex items-center justify-between rounded-xl border border-[#76E000]/30 bg-[#09421A]/80 px-3.5 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-black text-[#D9E81B] uppercase">
                          {dj.stageName}
                        </p>
                        {dj.genre ? (
                          <p className="text-[11px] text-white/80">
                            {dj.genre}
                          </p>
                        ) : null}
                      </div>
                      <CheckmarkBadge3D size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

