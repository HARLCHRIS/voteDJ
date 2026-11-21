import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminAccountByAuthUserId } from '@/lib/auth/admin-guard';
import {
  checkRateLimit,
  DEVICE_COOKIE_NAME,
  extractClientIp,
  hashWithSalt,
} from '@/lib/security/server-security';
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from '@/lib/supabase/server';
import { ALLOWED_SCORES, type AllowedScore, type VoterScoreReceipt } from '@/types';

interface SubmitScoreRequestBody {
  performanceId?: string;
  score?: number;
  deviceToken?: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Construit la réponse HTTP 409 lorsque le votant a déjà attribué une note définitive.
 */
function buildAlreadyVotedResponse(existingScore: AllowedScore) {
  return NextResponse.json(
    {
      error: 'Vous avez déjà voté pour ce DJ. Votre note est définitive.',
      existingScore,
    },
    { status: 409 }
  );
}

/**
 * Endpoint critique `submit-score` (FR-4, FR-5, FR-10, FR-12).
 * Vérifie côté serveur : session Google, note dans {2,4,6,8,10}, rate limiting,
 * liaison appareil/compte, passage ouvert, puis exécute `submit_public_score`.
 */
export async function POST(request: NextRequest) {
  const userClient = await createSupabaseServerClient();
  const serviceClient = createSupabaseServiceClient();

  if (!userClient || !serviceClient) {
    return NextResponse.json(
      { error: 'Le serveur de vote n’est pas encore configuré.' },
      { status: 503 }
    );
  }

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Connectez-vous avec Google avant de noter.' },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as SubmitScoreRequestBody;
  const performanceId = body.performanceId ?? '';
  const scoreValue = body.score;

  if (!UUID_REGEX.test(performanceId)) {
    return NextResponse.json(
      { error: 'Identifiant de passage invalide.' },
      { status: 400 }
    );
  }

  if (
    typeof scoreValue !== 'number' ||
    !ALLOWED_SCORES.includes(scoreValue as AllowedScore)
  ) {
    return NextResponse.json(
      { error: 'Note invalide. Valeurs acceptées : 2, 4, 6, 8 ou 10.' },
      { status: 400 }
    );
  }

  const clientIp = extractClientIp(request.headers);
  const ipHash = hashWithSalt(clientIp);

  // Limitation de débit par compte votant ET par IP (seuil IP large pour Wi-Fi/CGNAT festival)
  const [userRate, ipRate] = await Promise.all([
    checkRateLimit(`score:user:${user.id}`, 12, 60),
    checkRateLimit(`score:ip:${ipHash}`, 300, 60),
  ]);

  if (!userRate.allowed || !ipRate.allowed) {
    return NextResponse.json(
      { error: 'Trop de requêtes en peu de temps. Patientez quelques secondes.' },
      { status: 429 }
    );
  }

  // Exclure systématiquement les comptes Régie même si une ligne `voters` existait déjà
  const adminCheck = await getAdminAccountByAuthUserId(serviceClient, user.id);
  if (adminCheck.error) {
    return NextResponse.json(
      { error: 'Impossible de vérifier le statut du compte.' },
      { status: 500 }
    );
  }
  if (adminCheck.admin) {
    return NextResponse.json(
      {
        error:
          'Compte administrateur Régie détecté : déconnectez-vous pour voter avec un compte Google public.',
      },
      { status: 403 }
    );
  }

  const cookieStore = await cookies();
  const rawDeviceToken =
    cookieStore.get(DEVICE_COOKIE_NAME)?.value || body.deviceToken;

  if (!rawDeviceToken) {
    return NextResponse.json(
      { error: 'Appareil non vérifié. Rechargez la page pour lier votre téléphone.' },
      { status: 403 }
    );
  }

  const deviceTokenHash = hashWithSalt(rawDeviceToken);

  const { data: voter } = await serviceClient
    .from('voters')
    .select('id, is_blocked')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!voter) {
    return NextResponse.json(
      { error: 'Profil votant non initialisé. Rechargez la page.' },
      { status: 403 }
    );
  }

  if (voter.is_blocked) {
    return NextResponse.json(
      { error: 'Votre compte votant est bloqué par la modération.' },
      { status: 403 }
    );
  }

  const { data: device } = await serviceClient
    .from('devices')
    .select('id, voter_id, status, unlinked_at')
    .eq('device_token_hash', deviceTokenHash)
    .is('unlinked_at', null)
    .maybeSingle();

  if (!device || device.voter_id !== voter.id) {
    return NextResponse.json(
      {
        error:
          'Votre session et cet appareil ne correspondent pas. Contactez l’organisation.',
      },
      { status: 403 }
    );
  }

  if (device.status === 'blocked') {
    return NextResponse.json(
      { error: 'Cet appareil a été bloqué par la modération.' },
      { status: 403 }
    );
  }

  // Règle stricte : une fois votée, la note pour ce DJ ne peut plus être modifiée
  const { data: existingScore } = await serviceClient
    .from('public_scores')
    .select('id, score')
    .eq('performance_id', performanceId)
    .eq('voter_id', voter.id)
    .maybeSingle();

  if (existingScore) {
    return buildAlreadyVotedResponse(existingScore.score);
  }

  const { data: rpcResult, error: rpcError } = await serviceClient.rpc(
    'submit_public_score',
    {
      p_performance_id: performanceId,
      p_voter_id: voter.id,
      p_device_id: device.id,
      p_score: scoreValue as AllowedScore,
      p_ip_hash: ipHash,
    }
  );

  if (rpcError) {
    const { data: racedExistingScore } = await serviceClient
      .from('public_scores')
      .select('id, score')
      .eq('performance_id', performanceId)
      .eq('voter_id', voter.id)
      .maybeSingle();

    if (racedExistingScore) {
      return buildAlreadyVotedResponse(racedExistingScore.score);
    }

    return NextResponse.json(
      { error: rpcError.message || 'Notation impossible pour ce passage.' },
      { status: 400 }
    );
  }

  const receiptRaw = rpcResult as {
    score_id: string;
    performance_id: string;
    score: AllowedScore;
    updated_at: string;
  };

  const receipt: VoterScoreReceipt = {
    scoreId: receiptRaw.score_id,
    performanceId: receiptRaw.performance_id,
    score: receiptRaw.score,
    updatedAt: receiptRaw.updated_at,
  };

  return NextResponse.json(receipt, { status: 200 });
}

