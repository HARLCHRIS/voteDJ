-- ============================================================================
-- 0003_lock_vote_no_update.sql
-- Verrouille la note d'un votant : une fois attribuée, elle est définitive
-- et ne peut plus être modifiée pour le même passage.
-- ============================================================================

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
  ON CONFLICT (performance_id, voter_id) DO NOTHING
  RETURNING id, updated_at INTO v_score_id, v_updated_at;

  IF v_score_id IS NULL THEN
    RAISE EXCEPTION 'Vous avez déjà voté pour ce DJ. Votre note est définitive.';
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

REVOKE ALL ON FUNCTION public.submit_public_score(uuid, uuid, uuid, smallint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_score(uuid, uuid, uuid, smallint, text) TO service_role;

