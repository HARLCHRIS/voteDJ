import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local).');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CONCURRENT_VOTERS = Number(process.env.CONCURRENT_VOTERS || 50);

/**
 * Test automatisé de concurrence & de charge sur `submit_public_score` :
 * 1. Prouve qu'un même votant envoyant 20 requêtes parallèles ne crée qu'1 seule ligne.
 * 2. Prouve qu'une note hors {2,4,6,8,10} et qu'un passage fermé sont rejetés.
 * 3. Simule N votants concurrents simultanés et vérifie la cohérence de `score_aggregates`.
 * Nettoie toutes les données temporaires dans le bloc finally.
 */
async function runConcurrencyTest() {
  const testEventId = crypto.randomUUID();
  const testRoundId = crypto.randomUUID();
  const testDjOpenId = crypto.randomUUID();
  const testDjClosedId = crypto.randomUUID();
  const testPerfOpenId = crypto.randomUUID();
  const testPerfClosedId = crypto.randomUUID();
  const createdVoterIds = [];

  try {
    console.log('1) Préparation des données isolées...');
    await supabase.from('events').insert({
      id: testEventId,
      name: 'Load Test Event',
      slug: `load-test-${testEventId.slice(0, 8)}`,
    });

    await supabase.from('rounds').insert({
      id: testRoundId,
      event_id: testEventId,
      name: 'Prime 1',
      order_number: 1,
      status: 'live',
    });

    await supabase.from('djs').insert([
      { id: testDjOpenId, stage_name: 'DJ LOAD OPEN' },
      { id: testDjClosedId, stage_name: 'DJ LOAD CLOSED' },
    ]);

    await supabase.from('performances').insert([
      {
        id: testPerfOpenId,
        round_id: testRoundId,
        dj_id: testDjOpenId,
        performance_order: 1,
        status: 'open',
      },
      {
        id: testPerfClosedId,
        round_id: testRoundId,
        dj_id: testDjClosedId,
        performance_order: 2,
        status: 'closed',
      },
    ]);

    // Créer N votants + appareils liés
    const voterRows = Array.from({ length: CONCURRENT_VOTERS }, () => ({
      id: crypto.randomUUID(),
      auth_user_id: crypto.randomUUID(),
      auth_provider: 'google',
    }));
    createdVoterIds.push(...voterRows.map((v) => v.id));
    await supabase.from('voters').insert(voterRows);

    const deviceRows = voterRows.map((v, idx) => ({
      id: crypto.randomUUID(),
      voter_id: v.id,
      device_token_hash: `load-test-token-${testEventId}-${idx}`,
      status: 'active',
    }));
    await supabase.from('devices').insert(deviceRows);

    // TEST A : 20 requêtes simultanées par le MÊME votant
    console.log('\n2) Test concurrence double vote (20 requêtes simultanées, même votant)...');
    const firstVoter = voterRows[0];
    const firstDevice = deviceRows[0];
    const scoresToFire = Array.from({ length: 20 }, (_, i) => [2, 4, 6, 8, 10][i % 5]);

    const doubleVoteResults = await Promise.all(
      scoresToFire.map((score) =>
        supabase.rpc('submit_public_score', {
          p_performance_id: testPerfOpenId,
          p_voter_id: firstVoter.id,
          p_device_id: firstDevice.id,
          p_score: score,
          p_ip_hash: 'load-test-ip',
        })
      )
    );

    const doubleErrors = doubleVoteResults.filter((r) => r.error);
    const { count: singleVoterRows } = await supabase
      .from('public_scores')
      .select('id', { count: 'exact', head: true })
      .eq('performance_id', testPerfOpenId)
      .eq('voter_id', firstVoter.id);

    if (singleVoterRows !== 1) {
      throw new Error(`ÉCHEC doublon : ${singleVoterRows} lignes trouvées au lieu de 1 !`);
    }
    console.log(`   OK : ${20 - doubleErrors.length}/20 requêtes abouties, exactement ${singleVoterRows} ligne en base.`);

    // TEST B : Rejet note invalide (7) et passage fermé
    console.log('\n3) Test rejets serveur (note=7 et passage closed)...');
    const { error: badScoreErr } = await supabase.rpc('submit_public_score', {
      p_performance_id: testPerfOpenId,
      p_voter_id: firstVoter.id,
      p_device_id: firstDevice.id,
      p_score: 7,
      p_ip_hash: 'load-test-ip',
    });
    if (!badScoreErr) throw new Error('ÉCHEC : la note 7 aurait dû être refusée !');

    const { error: closedErr } = await supabase.rpc('submit_public_score', {
      p_performance_id: testPerfClosedId,
      p_voter_id: firstVoter.id,
      p_device_id: firstDevice.id,
      p_score: 8,
      p_ip_hash: 'load-test-ip',
    });
    if (!closedErr) throw new Error('ÉCHEC : le vote sur passage fermé aurait dû être refusé !');
    console.log('   OK : note 7 refusée + passage fermé refusé.');

    // TEST C : Pic de charge (N votants simultanés)
    console.log(`\n4) Test pic de charge (${CONCURRENT_VOTERS} votants simultanés)...`);
    const t0 = performance.now();
    const burstResults = await Promise.all(
      voterRows.map((v, i) =>
        supabase.rpc('submit_public_score', {
          p_performance_id: testPerfOpenId,
          p_voter_id: v.id,
          p_device_id: deviceRows[i].id,
          p_score: [2, 4, 6, 8, 10][i % 5],
          p_ip_hash: `load-ip-${i}`,
        })
      )
    );
    const elapsedMs = Math.round(performance.now() - t0);
    const burstFailures = burstResults.filter((r) => r.error);

    const { data: agg } = await supabase
      .from('score_aggregates')
      .select('scores_count, scores_sum')
      .eq('performance_id', testPerfOpenId)
      .single();

    if (burstFailures.length > 0) {
      throw new Error(`ÉCHEC pic : ${burstFailures.length} requêtes en erreur.`);
    }
    if (!agg || agg.scores_count !== CONCURRENT_VOTERS) {
      throw new Error(
        `ÉCHEC agrégat : scores_count=${agg?.scores_count}, attendu=${CONCURRENT_VOTERS}`
      );
    }

    console.log(
      `   OK : ${CONCURRENT_VOTERS}/${CONCURRENT_VOTERS} notes enregistrées en ${elapsedMs} ms (scores_count=${agg.scores_count}, sum=${agg.scores_sum}).`
    );
  } finally {
    console.log('\n5) Nettoyage des données de test...');
    await supabase.from('performances').delete().in('id', [testPerfOpenId, testPerfClosedId]);
    await supabase.from('djs').delete().in('id', [testDjOpenId, testDjClosedId]);
    await supabase.from('rounds').delete().eq('id', testRoundId);
    await supabase.from('events').delete().eq('id', testEventId);
    if (createdVoterIds.length > 0) {
      await supabase.from('voters').delete().in('id', createdVoterIds);
    }
    console.log('   Nettoyage terminé.');
  }
}

runConcurrencyTest().catch((err) => {
  console.error('TEST ÉCHOUÉ :', err.message || err);
  process.exit(1);
});

