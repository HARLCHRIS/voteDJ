-- ============================================================================
-- 0001_initial_schema.sql
-- Schéma de base de données pour DJ Challenge (Eat & Drink Festival Cotonou)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Événements
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  slug text NOT NULL UNIQUE,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Primes (Prime 1 & Prime 2)
CREATE TABLE public.rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name IN ('Prime 1', 'Prime 2')),
  order_number smallint NOT NULL CHECK (order_number IN (1, 2)),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'live', 'completed')),
  min_scores_required integer NOT NULL DEFAULT 5 CHECK (min_scores_required >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, order_number)
);

-- 3. DJs
CREATE TABLE public.djs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_name text NOT NULL CHECK (char_length(trim(stage_name)) > 0),
  real_name text,
  bio text,
  genre text,
  photo_url text,
  media_url text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Passages (lecture publique sans scores)
CREATE TABLE public.performances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE RESTRICT,
  dj_id uuid NOT NULL UNIQUE REFERENCES public.djs(id) ON DELETE CASCADE,
  performance_order integer NOT NULL CHECK (performance_order > 0),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'open', 'closed')),
  opened_at timestamptz,
  closed_at timestamptz,
  is_qualified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Un seul passage ouvert à la fois par prime
CREATE UNIQUE INDEX idx_one_open_performance_per_round
  ON public.performances (round_id)
  WHERE status = 'open';

CREATE INDEX idx_performances_round_order
  ON public.performances (round_id, performance_order);

-- 5. Résultats figés des passages (admins uniquement)
CREATE TABLE public.performance_results (
  performance_id uuid PRIMARY KEY REFERENCES public.performances(id) ON DELETE CASCADE,
  public_avg numeric(4,2) NOT NULL DEFAULT 0.00,
  public_count integer NOT NULL DEFAULT 0,
  public_rank integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Administrateurs (défini avant public_scores pour la FK invalidated_by)
CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('super_admin', 'moderator')),
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Votants (Google Auth)
CREATE TABLE public.voters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE,
  auth_provider text NOT NULL DEFAULT 'google' CHECK (auth_provider = 'google'),
  created_at timestamptz NOT NULL DEFAULT now(),
  is_blocked boolean NOT NULL DEFAULT false
);

-- 8. Appareils liés (1 appareil = 1 compte)
CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id uuid NOT NULL REFERENCES public.voters(id) ON DELETE CASCADE,
  device_token_hash text NOT NULL UNIQUE,
  fingerprint_hash text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'flagged', 'blocked')),
  ip_hash text,
  user_agent text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  unlinked_at timestamptz
);

-- Un seul appareil actif par votant
CREATE UNIQUE INDEX idx_one_active_device_per_voter
  ON public.devices (voter_id)
  WHERE unlinked_at IS NULL;

CREATE INDEX idx_devices_fingerprint_hash
  ON public.devices (fingerprint_hash)
  WHERE fingerprint_hash IS NOT NULL;

-- 9. Événements d'appareils (journal anti-fraude immuable)
CREATE TABLE public.device_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  voter_id uuid REFERENCES public.voters(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (
    event_type IN (
      'linked',
      'refused_second_account',
      'refused_other_device',
      'flagged',
      'blocked',
      'unblocked',
      'unlinked_by_admin'
    )
  ),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_events_created_at ON public.device_events (created_at DESC);

-- 10. Notes publiques (valeurs strictement parmi 2, 4, 6, 8, 10)
CREATE TABLE public.public_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id uuid NOT NULL REFERENCES public.performances(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES public.voters(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE RESTRICT,
  score smallint NOT NULL CHECK (score IN (2, 4, 6, 8, 10)),
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_valid boolean NOT NULL DEFAULT true,
  invalidated_reason text,
  invalidated_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  UNIQUE (performance_id, voter_id)
);

CREATE INDEX idx_public_scores_performance_valid
  ON public.public_scores (performance_id, is_valid);

-- 11. Agrégats temps réel (admins uniquement)
CREATE TABLE public.score_aggregates (
  performance_id uuid PRIMARY KEY REFERENCES public.performances(id) ON DELETE CASCADE,
  scores_sum integer NOT NULL DEFAULT 0,
  scores_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 12. Journal d'audit immuable
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity_created
  ON public.audit_logs (entity, created_at DESC);

-- Trigger générique updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rounds_updated_at BEFORE UPDATE ON public.rounds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_djs_updated_at BEFORE UPDATE ON public.djs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_performances_updated_at BEFORE UPDATE ON public.performances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_public_scores_updated_at BEFORE UPDATE ON public.public_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

