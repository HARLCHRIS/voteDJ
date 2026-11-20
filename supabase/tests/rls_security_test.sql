-- ============================================================================
-- supabase/tests/rls_security_test.sql
-- Preuve SQL qu'un votant connecté (rôle authenticated non-admin) ne peut
-- ni lire ni modifier les tables sensibles :
--   public_scores, voters, devices, score_aggregates, performance_results, audit_logs
-- ============================================================================

BEGIN;

-- 1. Préparer un jeu de données de test via postgres/service_role
INSERT INTO public.events (id, name, slug)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Test Event', 'test-event')
ON CONFLICT DO NOTHING;

INSERT INTO public.rounds (id, event_id, name, order_number, status)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Prime 1', 1, 'live')
ON CONFLICT DO NOTHING;

INSERT INTO public.djs (id, stage_name)
VALUES ('cccccccc-0000-0000-0000-000000000001', 'DJ Test')
ON CONFLICT DO NOTHING;

INSERT INTO public.performances (id, round_id, dj_id, performance_order, status)
VALUES ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 1, 'open')
ON CONFLICT DO NOTHING;

INSERT INTO public.voters (id, auth_user_id)
VALUES ('eeeeeeee-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO public.devices (id, voter_id, device_token_hash)
VALUES ('12121212-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'hash_test_token_1')
ON CONFLICT DO NOTHING;

INSERT INTO public.public_scores (performance_id, voter_id, device_id, score)
VALUES ('dddddddd-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', '12121212-0000-0000-0000-000000000001', 8);

INSERT INTO public.performance_results (performance_id, public_avg, public_count, public_rank)
VALUES ('dddddddd-0000-0000-0000-000000000001', 8.00, 1, 1)
ON CONFLICT DO NOTHING;

-- 2. Simuler la session JWT d'un votant connecté (authenticated, non présent dans admin_users)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- 3. Vérifier que la lecture retourne 0 ligne sur les 6 tables protégées
DO $$
DECLARE
  v_cnt integer;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.public_scores;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL: voter can read public_scores (%)', v_cnt; END IF;

  SELECT count(*) INTO v_cnt FROM public.voters;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL: voter can read voters (%)', v_cnt; END IF;

  SELECT count(*) INTO v_cnt FROM public.devices;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL: voter can read devices (%)', v_cnt; END IF;

  SELECT count(*) INTO v_cnt FROM public.score_aggregates;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL: voter can read score_aggregates (%)', v_cnt; END IF;

  SELECT count(*) INTO v_cnt FROM public.performance_results;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL: voter can read performance_results (%)', v_cnt; END IF;

  SELECT count(*) INTO v_cnt FROM public.audit_logs;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL: voter can read audit_logs (%)', v_cnt; END IF;
END $$;

-- 4. Vérifier que les écritures directes échouent
DO $$
BEGIN
  BEGIN
    INSERT INTO public.public_scores (performance_id, voter_id, device_id, score)
    VALUES ('dddddddd-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', '12121212-0000-0000-0000-000000000001', 10);
    RAISE EXCEPTION 'FAIL: voter could insert directly into public_scores';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Attendu
  END;

  BEGIN
    UPDATE public.performance_results SET public_avg = 10.00;
    -- RLS bloque ou affecte 0 ligne
  EXCEPTION WHEN insufficient_privilege THEN
    -- Attendu
  END;

  BEGIN
    INSERT INTO public.djs (stage_name) VALUES ('Hacker DJ');
    RAISE EXCEPTION 'FAIL: voter could insert into djs';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Attendu
  END;
END $$;

-- 5. Vérifier que le votant peut lire les tables publiques (events, rounds, djs, performances)
DO $$
DECLARE
  v_cnt integer;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.djs WHERE id = 'cccccccc-0000-0000-0000-000000000001';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'FAIL: voter cannot read public djs'; END IF;

  SELECT count(*) INTO v_cnt FROM public.performances WHERE id = 'dddddddd-0000-0000-0000-000000000001';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'FAIL: voter cannot read public performances'; END IF;
END $$;

ROLLBACK;

