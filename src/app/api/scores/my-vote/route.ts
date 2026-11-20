import { NextResponse, type NextRequest } from 'next/server';
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from '@/lib/supabase/server';
import type { AllowedScore } from '@/types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Retourne uniquement la note déjà enregistrée par le votant connecté
 * pour un passage donné, afin de verrouiller l'UI même après rechargement.
 */
export async function GET(request: NextRequest) {
  const performanceId = request.nextUrl.searchParams.get('performanceId') ?? '';
  if (!UUID_REGEX.test(performanceId)) {
    return NextResponse.json({ score: null }, { status: 400 });
  }

  const userClient = await createSupabaseServerClient();
  const serviceClient = createSupabaseServiceClient();
  if (!userClient || !serviceClient) {
    return NextResponse.json({ score: null });
  }

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ score: null }, { status: 401 });
  }

  const { data: voter } = await serviceClient
    .from('voters')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!voter) {
    return NextResponse.json({ score: null });
  }

  const { data: existingScore } = await serviceClient
    .from('public_scores')
    .select('score')
    .eq('performance_id', performanceId)
    .eq('voter_id', voter.id)
    .maybeSingle();

  return NextResponse.json(
    {
      score: (existingScore?.score ?? null) as AllowedScore | null,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    }
  );
}

