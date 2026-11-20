-- ============================================================================
-- 0002_rls_and_functions.sql
-- Politiques RLS strictes, triggers métier et RPC transactionnelles
-- ============================================================================

-- 1. Fonctions utilitaires de rôle (SECURITY DEFINER pour éviter la récursion RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.admin_users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- 2. Activation RLS obligatoire sur TOUTES les tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.djs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Politiques RLS publiques (lecture seule uniquement sur les données publiques)
-- ============================================================================

CREATE POLICY "events_public_read" ON public.events
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "events_admin_write" ON public.events
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "rounds_public_read" ON public.rounds
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "rounds_admin_write" ON public.rounds
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "djs_public_read" ON public.djs
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "djs_admin_write" ON public.djs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "performances_public_read" ON public.performances
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "performances_admin_write" ON public.performances
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 4. Politiques RLS strictes (tables sensibles : ADMINS UNIQUEMENT)
-- Les votants et anonymes ne peuvent NI lire NI modifier ces tables.
-- ============================================================================

CREATE POLICY "performance_results_admin_only" ON public.performance_results
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_users_self_or_super" ON public.admin_users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "admin_users_super_write" ON public.admin_users
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "voters_admin_read" ON public.voters
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "voters_admin_update" ON public.voters
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "devices_admin_read" ON public.devices
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "devices_admin_update" ON public.devices
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "device_events_admin_read" ON public.device_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "public_scores_admin_read" ON public.public_scores
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "public_scores_admin_update" ON public.public_scores
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "score_aggregates_admin_read" ON public.score_aggregates
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "audit_logs_admin_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 5. Triggers métier et intégrité
-- ============================================================================

-- Verrouillage de la prime (round_id) dès que le passage a été ouvert
CREATE OR REPLACE FUNCTION public.prevent_round_change_after_open()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.round_id IS DISTINCT FROM OLD.round_id AND OLD.status <> 'waiting' THEN
    RAISE EXCEPTION 'La prime ne peut plus être modifiée après l''ouverture du passage.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_round_change_after_open
  BEFORE UPDATE ON public.performances
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_round_change_after_open();

-- Immuabilité des journaux audit_logs et device_events
CREATE OR REPLACE FUNCTION public.prevent_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Les journaux d''audit et événements appareils sont immuables.';
END;
$$;

CREATE TRIGGER trg_immutable_audit_logs
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_log_mutation();

CREATE TRIGGER trg_immutable_device_events
  BEFORE UPDATE OR DELETE ON public.device_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_log_mutation();

-- Maintien atomique de score_aggregates sur toute modification de public_scores
CREATE OR REPLACE FUNCTION public.sync_score_aggregates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta_sum integer := 0;
  v_delta_count integer := 0;
  v_perf_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_perf_id := NEW.performance_id;
    IF NEW.is_valid THEN
      v_delta_sum := NEW.score;
      v_delta_count := 1;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_perf_id := NEW.performance_id;
    IF OLD.is_valid AND NEW.is_valid THEN
      v_delta_sum := NEW.score - OLD.score;
      v_delta_count := 0;
    ELSIF NOT OLD.is_valid AND NEW.is_valid THEN
      v_delta_sum := NEW.score;
      v_delta_count := 1;
    ELSIF OLD.is_valid AND NOT NEW.is_valid THEN
      v_delta_sum := -OLD.score;
      v_delta_count := -1;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_perf_id := OLD.performance_id;
    IF OLD.is_valid THEN
      v_delta_sum := -OLD.score;
      v_delta_count := -1;
    END IF;
  END IF;

  INSERT INTO public.score_aggregates (performance_id, scores_sum, scores_count, updated_at)
  VALUES (v_perf_id, GREATEST(0, v_delta_sum), GREATEST(0, v_delta_count), now())
  ON CONFLICT (performance_id) DO UPDATE
  SET
    scores_sum = GREATEST(0, public.score_aggregates.scores_sum + v_delta_sum),
    scores_count = GREATEST(0, public.score_aggregates.scores_count + v_delta_count),
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_score_aggregates
  AFTER INSERT OR UPDATE OR DELETE ON public.public_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_score_aggregates();

-- ============================================================================
-- 6. Fonctions RPC transactionnelles (Admin & Notation)
-- ============================================================================

-- Recalcul et classement des résultats d'une prime (sans départage d'égalité)
CREATE OR REPLACE FUNCTION public.recalculate_round_results(p_round_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_scores integer;
BEGIN
  SELECT min_scores_required INTO v_min_scores
  FROM public.rounds
  WHERE id = p_round_id;

  IF v_min_scores IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.performance_results (performance_id, public_avg, public_count, public_rank, updated_at)
  SELECT
    p.id,
    CASE
      WHEN COALESCE(sa.scores_count, 0) > 0
      THEN ROUND((sa.scores_sum::numeric / sa.scores_count::numeric), 2)
      ELSE 0.00
    END AS avg_score,
    COALESCE(sa.scores_count, 0) AS cnt,
    NULL::integer,
    now()
  FROM public.performances p
  LEFT JOIN public.score_aggregates sa ON sa.performance_id = p.id
  WHERE p.round_id = p_round_id
  ON CONFLICT (performance_id) DO UPDATE
  SET
    public_avg = EXCLUDED.public_avg,
    public_count = EXCLUDED.public_count,
    updated_at = now();

  WITH ranked AS (
    SELECT
      pr.performance_id,
      CASE
        WHEN pr.public_count >= v_min_scores AND pr.public_count > 0
        THEN RANK() OVER (ORDER BY pr.public_avg DESC)::integer
        ELSE NULL::integer
      END AS computed_rank
    FROM public.performance_results pr
    JOIN public.performances p ON p.id = pr.performance_id
    WHERE p.round_id = p_round_id
  )
  UPDATE public.performance_results pr
  SET public_rank = r.computed_rank, updated_at = now()
  FROM ranked r
  WHERE pr.performance_id = r.performance_id;
END;
$$;

-- Création rapide d'un DJ + passage automatique dans la prime
CREATE OR REPLACE FUNCTION public.admin_create_dj(
  p_stage_name text,
  p_round_id uuid,
  p_real_name text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_genre text DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_media_url text DEFAULT NULL,
  p_social_links jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dj_id uuid;
  v_perf_id uuid;
  v_next_order integer;
  v_actor uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé : administrateur requis.';
  END IF;

  IF p_stage_name IS NULL OR char_length(trim(p_stage_name)) = 0 THEN
    RAISE EXCEPTION 'Le nom de scène est obligatoire.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.rounds WHERE id = p_round_id) THEN
    RAISE EXCEPTION 'Prime introuvable.';
  END IF;

  v_actor := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  INSERT INTO public.djs (stage_name, real_name, bio, genre, photo_url, media_url, social_links)
  VALUES (
    trim(p_stage_name),
    NULLIF(trim(COALESCE(p_real_name, '')), ''),
    NULLIF(trim(COALESCE(p_bio, '')), ''),
    NULLIF(trim(COALESCE(p_genre, '')), ''),
    NULLIF(trim(COALESCE(p_photo_url, '')), ''),
    NULLIF(trim(COALESCE(p_media_url, '')), ''),
    COALESCE(p_social_links, '{}'::jsonb)
  )
  RETURNING id INTO v_dj_id;

  SELECT COALESCE(MAX(performance_order), 0) + 1
  INTO v_next_order
  FROM public.performances
  WHERE round_id = p_round_id;

  INSERT INTO public.performances (round_id, dj_id, performance_order, status)
  VALUES (p_round_id, v_dj_id, v_next_order, 'waiting')
  RETURNING id INTO v_perf_id;

  INSERT INTO public.score_aggregates (performance_id, scores_sum, scores_count)
  VALUES (v_perf_id, 0, 0)
  ON CONFLICT (performance_id) DO NOTHING;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
  VALUES (
    v_actor,
    'dj_created',
    'djs',
    v_dj_id,
    jsonb_build_object(
      'after', jsonb_build_object(
        'stage_name', trim(p_stage_name),
        'round_id', p_round_id,
        'performance_id', v_perf_id,
        'performance_order', v_next_order
      )
    )
  );

  RETURN jsonb_build_object('dj_id', v_dj_id, 'performance_id', v_perf_id, 'performance_order', v_next_order);
END;
$$;

-- Modification d'un DJ (nom toujours modifiable, prime verrouillée après ouverture)
CREATE OR REPLACE FUNCTION public.admin_update_dj(
  p_dj_id uuid,
  p_stage_name text,
  p_round_id uuid DEFAULT NULL,
  p_real_name text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_genre text DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_media_url text DEFAULT NULL,
  p_social_links jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_dj public.djs%ROWTYPE;
  v_old_perf public.performances%ROWTYPE;
  v_next_order integer;
  v_actor uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé : administrateur requis.';
  END IF;

  SELECT * INTO v_old_dj FROM public.djs WHERE id = p_dj_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DJ introuvable.';
  END IF;

  SELECT * INTO v_old_perf FROM public.performances WHERE dj_id = p_dj_id;
  v_actor := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  UPDATE public.djs
  SET
    stage_name = COALESCE(NULLIF(trim(p_stage_name), ''), stage_name),
    real_name = CASE WHEN p_real_name IS NOT NULL THEN NULLIF(trim(p_real_name), '') ELSE real_name END,
    bio = CASE WHEN p_bio IS NOT NULL THEN NULLIF(trim(p_bio), '') ELSE bio END,
    genre = CASE WHEN p_genre IS NOT NULL THEN NULLIF(trim(p_genre), '') ELSE genre END,
    photo_url = CASE WHEN p_photo_url IS NOT NULL THEN NULLIF(trim(p_photo_url), '') ELSE photo_url END,
    media_url = CASE WHEN p_media_url IS NOT NULL THEN NULLIF(trim(p_media_url), '') ELSE media_url END,
    social_links = COALESCE(p_social_links, social_links)
  WHERE id = p_dj_id;

  IF p_round_id IS NOT NULL AND p_round_id IS DISTINCT FROM v_old_perf.round_id THEN
    IF v_old_perf.status <> 'waiting' THEN
      RAISE EXCEPTION 'Impossible de changer la prime : le passage de ce DJ a déjà été ouvert.';
    END IF;

    SELECT COALESCE(MAX(performance_order), 0) + 1
    INTO v_next_order
    FROM public.performances
    WHERE round_id = p_round_id;

    UPDATE public.performances
    SET round_id = p_round_id, performance_order = v_next_order
    WHERE id = v_old_perf.id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
  VALUES (
    v_actor,
    'dj_updated',
    'djs',
    p_dj_id,
    jsonb_build_object(
      'before', jsonb_build_object('stage_name', v_old_dj.stage_name, 'round_id', v_old_perf.round_id),
      'after', jsonb_build_object('stage_name', COALESCE(NULLIF(trim(p_stage_name), ''), v_old_dj.stage_name), 'round_id', COALESCE(p_round_id, v_old_perf.round_id))
    )
  );
END;
$$;

-- Régie Live : ouvrir un passage (ferme automatiquement le précédent dans la prime)
CREATE OR REPLACE FUNCTION public.admin_open_performance(p_performance_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.performances%ROWTYPE;
  v_actor uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé : administrateur requis.';
  END IF;

  SELECT * INTO v_target FROM public.performances WHERE id = p_performance_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Passage introuvable.';
  END IF;

  v_actor := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  -- Fermer tout passage actuellement ouvert dans la même prime
  UPDATE public.performances
  SET status = 'closed', closed_at = now()
  WHERE round_id = v_target.round_id
    AND status = 'open'
    AND id <> v_target.id;

  -- Ouvrir le passage cible
  UPDATE public.performances
  SET status = 'open', opened_at = COALESCE(opened_at, now()), closed_at = NULL
  WHERE id = v_target.id;

  -- Passer la prime en statut live si elle ne l'est pas
  UPDATE public.rounds
  SET status = 'live'
  WHERE id = v_target.round_id
    AND status IN ('draft', 'scheduled');

  PERFORM public.recalculate_round_results(v_target.round_id);

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
  VALUES (
    v_actor,
    'performance_opened',
    'performances',
    v_target.id,
    jsonb_build_object('round_id', v_target.round_id, 'dj_id', v_target.dj_id)
  );
END;
$$;

-- Régie Live : clôturer manuellement un passage
CREATE OR REPLACE FUNCTION public.admin_close_performance(p_performance_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.performances%ROWTYPE;
  v_actor uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé : administrateur requis.';
  END IF;

  SELECT * INTO v_target FROM public.performances WHERE id = p_performance_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Passage introuvable.';
  END IF;

  v_actor := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  UPDATE public.performances
  SET status = 'closed', closed_at = now()
  WHERE id = v_target.id;

  PERFORM public.recalculate_round_results(v_target.round_id);

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
  VALUES (
    v_actor,
    'performance_closed',
    'performances',
    v_target.id,
    jsonb_build_object('round_id', v_target.round_id, 'dj_id', v_target.dj_id)
  );
END;
$$;

-- Invalidation d'une note suspecte avec motif obligatoire
CREATE OR REPLACE FUNCTION public.admin_invalidate_score(p_score_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_score_row public.public_scores%ROWTYPE;
  v_round_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé : administrateur requis.';
  END IF;

  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Un motif d''invalidation obligatoire (min 3 caractères) est requis.';
  END IF;

  v_admin_id := public.current_admin_id();
  SELECT * INTO v_score_row FROM public.public_scores WHERE id = p_score_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Note introuvable.';
  END IF;

  UPDATE public.public_scores
  SET
    is_valid = false,
    invalidated_reason = trim(p_reason),
    invalidated_by = v_admin_id
  WHERE id = p_score_id;

  SELECT round_id INTO v_round_id FROM public.performances WHERE id = v_score_row.performance_id;
  PERFORM public.recalculate_round_results(v_round_id);

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
  VALUES (
    auth.uid(),
    'score_invalidated',
    'public_scores',
    p_score_id,
    jsonb_build_object(
      'performance_id', v_score_row.performance_id,
      'voter_id', v_score_row.voter_id,
      'score', v_score_row.score,
      'reason', trim(p_reason)
    )
  );
END;
$$;

-- Soumission atomique & idempotente de note (appelée côté serveur par service_role)
CREATE OR REPLACE FUNCTION public.submit_public_score(
  p_performance_id uuid,
  p_voter_id uuid,
  p_device_id uuid,
  p_score smallint,
  p_ip_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perf_status text;
  v_voter_blocked boolean;
  v_device public.devices%ROWTYPE;
  v_score_id uuid;
  v_updated_at timestamptz;
BEGIN
  IF p_score NOT IN (2, 4, 6, 8, 10) THEN
    RAISE EXCEPTION 'Note invalide : valeurs autorisées 2, 4, 6, 8, 10.';
  END IF;

  SELECT status INTO v_perf_status
  FROM public.performances
  WHERE id = p_performance_id;

  IF v_perf_status IS NULL THEN
    RAISE EXCEPTION 'Passage introuvable.';
  END IF;

  IF v_perf_status <> 'open' THEN
    RAISE EXCEPTION 'La notation pour ce passage est fermée.';
  END IF;

  SELECT is_blocked INTO v_voter_blocked
  FROM public.voters
  WHERE id = p_voter_id;

  IF v_voter_blocked IS NULL THEN
    RAISE EXCEPTION 'Votant non enregistré.';
  END IF;

  IF v_voter_blocked THEN
    RAISE EXCEPTION 'Ce compte votant est bloqué.';
  END IF;

  SELECT * INTO v_device
  FROM public.devices
  WHERE id = p_device_id;

  IF NOT FOUND OR v_device.unlinked_at IS NOT NULL OR v_device.voter_id <> p_voter_id THEN
    RAISE EXCEPTION 'Appareil non lié à ce compte.';
  END IF;

  IF v_device.status = 'blocked' THEN
    RAISE EXCEPTION 'Cet appareil est bloqué.';
  END IF;

  INSERT INTO public.public_scores (performance_id, voter_id, device_id, score, ip_hash, is_valid)
  VALUES (p_performance_id, p_voter_id, p_device_id, p_score, p_ip_hash, true)
  ON CONFLICT (performance_id, voter_id) DO UPDATE
  SET
    score = EXCLUDED.score,
    device_id = EXCLUDED.device_id,
    ip_hash = COALESCE(EXCLUDED.ip_hash, public.public_scores.ip_hash),
    updated_at = now()
  WHERE public.public_scores.is_valid = true
  RETURNING id, updated_at INTO v_score_id, v_updated_at;

  IF v_score_id IS NULL THEN
    RAISE EXCEPTION 'Votre note précédente a été invalidée par un modérateur.';
  END IF;

  UPDATE public.devices SET last_seen_at = now() WHERE id = p_device_id;

  RETURN jsonb_build_object(
    'score_id', v_score_id,
    'performance_id', p_performance_id,
    'score', p_score,
    'updated_at', v_updated_at
  );
END;
$$;

-- Restreindre l'exécution directe de submit_public_score au service_role uniquement
REVOKE ALL ON FUNCTION public.submit_public_score(uuid, uuid, uuid, smallint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_score(uuid, uuid, uuid, smallint, text) TO service_role;

-- Activer Realtime pour le back-office admin (score_aggregates, performances, device_events)
ALTER PUBLICATION supabase_realtime ADD TABLE public.score_aggregates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.performances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_events;

