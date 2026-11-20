-- ============================================================================
-- Seed initial : Eat & Drink Festival Cotonou 2027 – DJ Challenge
-- ============================================================================

INSERT INTO public.events (id, name, slug, start_date, end_date)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Eat & Drink Festival Cotonou 2027 – DJ Challenge',
  'eat-drink-2027',
  '2027-01-26T18:00:00Z',
  '2027-01-31T23:59:59Z'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.rounds (id, event_id, name, order_number, status, min_scores_required)
VALUES
  (
    '22222222-2222-2222-2222-222222222221',
    '11111111-1111-1111-1111-111111111111',
    'Prime 1',
    1,
    'scheduled',
    5
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'Prime 2',
    2,
    'draft',
    5
  )
ON CONFLICT (event_id, order_number) DO NOTHING;

