import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminAccountByAuthUserId } from '@/lib/auth/admin-guard';
import {
  checkRateLimit,
  DEVICE_COOKIE_NAME,
  extractClientIp,
  hashWithSalt,
  verifyTurnstileToken,
} from '@/lib/security/server-security';
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from '@/lib/supabase/server';
import type { DeviceBindingResult } from '@/types';

interface BindDeviceRequestBody {
  deviceToken?: string;
  fingerprint?: string;
  turnstileToken?: string | null;
  checkExistingOnly?: boolean;
}

/**
 * Lie de manière stricte 1 compte Google ↔ 1 appareil (FR-12).
 * Refuse tout second compte sur le même appareil, et tout second appareil sur le même compte.
 */
export async function POST(request: NextRequest) {
  const userClient = await createSupabaseServerClient();
  const serviceClient = createSupabaseServiceClient();

  if (!userClient || !serviceClient) {
    return NextResponse.json(
      {
        bound: false,
        deviceId: null,
        voterId: null,
        conflictType: null,
        message: 'Supabase n’est pas encore configuré.',
      } satisfies DeviceBindingResult,
      { status: 503 }
    );
  }

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Session Google requise.' },
      { status: 401 }
    );
  }

  const clientIp = extractClientIp(request.headers);
  const ipHash = hashWithSalt(clientIp);
  // Tolérance élevée par IP pour absorber le Wi-Fi public du festival et le CGNAT mobile
  const rateCheck = await checkRateLimit(`bind:${ipHash}`, 120, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        bound: false,
        deviceId: null,
        voterId: null,
        conflictType: 'blocked',
        message: 'Trop de tentatives depuis cette connexion. Patientez une minute.',
      } satisfies DeviceBindingResult,
      { status: 429 }
    );
  }

  // Empêcher tout compte administrateur Régie de créer un profil votant ou lier un appareil
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
        bound: false,
        deviceId: null,
        voterId: null,
        conflictType: null,
        message:
          'Compte administrateur Régie détecté : déconnectez-vous pour voter avec un compte Google public.',
      } satisfies DeviceBindingResult,
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as BindDeviceRequestBody;
  const checkExistingOnly = Boolean(body.checkExistingOnly);

  const cookieStore = await cookies();
  const rawToken =
    cookieStore.get(DEVICE_COOKIE_NAME)?.value ||
    body.deviceToken ||
    crypto.randomUUID();

  const deviceTokenHash = hashWithSalt(rawToken);
  const fingerprintHash = body.fingerprint
    ? hashWithSalt(body.fingerprint)
    : null;
  const userAgent = request.headers.get('user-agent') || null;

  // 1. Vérifier d'abord si le profil votant et son appareil sont déjà liés
  // (les votants déjà liés ne doivent pas être bloqués par Turnstile au rechargement)
  let { data: voter } = await serviceClient
    .from('voters')
    .select('id, is_blocked')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (voter?.is_blocked) {
    return NextResponse.json(
      {
        bound: false,
        deviceId: null,
        voterId: voter.id,
        conflictType: 'blocked',
        message: 'Ce compte votant a été bloqué par la modération.',
      } satisfies DeviceBindingResult,
      { status: 403 }
    );
  }

  // 2. Vérifier si ce jeton d'appareil est déjà lié à un AUTRE votant actif
  const { data: tokenDevice } = await serviceClient
    .from('devices')
    .select('id, voter_id, status, unlinked_at')
    .eq('device_token_hash', deviceTokenHash)
    .maybeSingle();

  if (
    voter &&
    tokenDevice &&
    tokenDevice.unlinked_at === null &&
    tokenDevice.voter_id !== voter.id
  ) {
    await serviceClient.from('device_events').insert({
      device_id: tokenDevice.id,
      voter_id: voter.id,
      event_type: 'refused_second_account',
      metadata: { ip_hash: ipHash, existing_voter_id: tokenDevice.voter_id },
    });

    return NextResponse.json(
      {
        bound: false,
        deviceId: null,
        voterId: voter.id,
        conflictType: 'second_account',
        message:
          'Cet appareil est déjà utilisé avec un autre compte Google. Un seul compte par téléphone est autorisé.',
      } satisfies DeviceBindingResult,
      { status: 403 }
    );
  }

  // 3. Vérifier si ce votant possède déjà un appareil actif
  const { data: voterActiveDevice } = voter
    ? await serviceClient
      .from('devices')
      .select('id, device_token_hash, fingerprint_hash, status')
      .eq('voter_id', voter.id)
      .is('unlinked_at', null)
      .maybeSingle()
    : { data: null };

  if (voter && voterActiveDevice) {
    if (voterActiveDevice.status === 'blocked') {
      return NextResponse.json(
        {
          bound: false,
          deviceId: voterActiveDevice.id,
          voterId: voter.id,
          conflictType: 'blocked',
          message: 'Cet appareil est bloqué par la modération.',
        } satisfies DeviceBindingResult,
        { status: 403 }
      );
    }

    const tokenMatches = voterActiveDevice.device_token_hash === deviceTokenHash;
    const fingerprintMatches =
      Boolean(fingerprintHash) &&
      voterActiveDevice.fingerprint_hash === fingerprintHash;

    if (!tokenMatches && !fingerprintMatches) {
      await serviceClient.from('device_events').insert({
        device_id: voterActiveDevice.id,
        voter_id: voter.id,
        event_type: 'refused_other_device',
        metadata: { ip_hash: ipHash },
      });

      return NextResponse.json(
        {
          bound: false,
          deviceId: null,
          voterId: voter.id,
          conflictType: 'other_device',
          message:
            'Votre compte Google est déjà lié à un autre téléphone. Contactez l’organisation si vous avez changé d’appareil.',
        } satisfies DeviceBindingResult,
        { status: 403 }
      );
    }

    // Renouvellement silencieux (et mise à jour du hash de jeton si cookies/stockage effacés)
    const deviceUpdatePayload: {
      last_seen_at: string;
      ip_hash: string;
      device_token_hash?: string;
    } = {
      last_seen_at: new Date().toISOString(),
      ip_hash: ipHash,
    };

    if (!tokenMatches && fingerprintMatches) {
      deviceUpdatePayload.device_token_hash = deviceTokenHash;
    }

    await serviceClient
      .from('devices')
      .update(deviceUpdatePayload)
      .eq('id', voterActiveDevice.id);

    const okResponse = NextResponse.json({
      bound: true,
      deviceId: voterActiveDevice.id,
      voterId: voter.id,
      conflictType: null,
      message: null,
    } satisfies DeviceBindingResult);

    okResponse.cookies.set(DEVICE_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return okResponse;
  }

  // En mode pré-vérification rapide, ne pas exiger Turnstile ni créer de profil avant validation
  if (checkExistingOnly) {
    return NextResponse.json({
      bound: false,
      deviceId: null,
      voterId: voter?.id ?? null,
      conflictType: null,
      message: null,
    } satisfies DeviceBindingResult);
  }

  // 4. Vérification anti-robot obligatoire uniquement pour une nouvelle liaison d'appareil
  const turnstileResult = await verifyTurnstileToken(body.turnstileToken, clientIp);
  if (!turnstileResult.success) {
    return NextResponse.json(
      {
        bound: false,
        deviceId: null,
        voterId: null,
        conflictType: 'blocked',
        message: turnstileResult.error ?? 'Vérification anti-robot échouée.',
      } satisfies DeviceBindingResult,
      { status: 403 }
    );
  }

  // Créer le profil votant s'il n'existe pas encore
  if (!voter) {
    const { data: insertedVoter, error: voterErr } = await serviceClient
      .from('voters')
      .insert({ auth_user_id: user.id, auth_provider: 'google' })
      .select('id, is_blocked')
      .single();

    if (voterErr || !insertedVoter) {
      return NextResponse.json(
        { error: 'Impossible de créer le profil votant.' },
        { status: 500 }
      );
    }
    voter = insertedVoter;
  }

  // Revérifier si le jeton appartient à un autre votant dans le cas où `voter` vient d'être créé
  if (
    tokenDevice &&
    tokenDevice.unlinked_at === null &&
    tokenDevice.voter_id !== voter.id
  ) {
    await serviceClient.from('device_events').insert({
      device_id: tokenDevice.id,
      voter_id: voter.id,
      event_type: 'refused_second_account',
      metadata: { ip_hash: ipHash, existing_voter_id: tokenDevice.voter_id },
    });

    return NextResponse.json(
      {
        bound: false,
        deviceId: null,
        voterId: voter.id,
        conflictType: 'second_account',
        message:
          'Cet appareil est déjà utilisé avec un autre compte Google. Un seul compte par téléphone est autorisé.',
      } satisfies DeviceBindingResult,
      { status: 403 }
    );
  }

  // 5. Vérifier s'il y a création en rafale depuis la même IP ou empreinte (FR-13)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentIpCount } = await serviceClient
    .from('devices')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('first_seen_at', tenMinutesAgo);

  const shouldFlag = (recentIpCount ?? 0) >= 25;

  // Générer un nouveau token si un ancien token délié existait
  const finalRawToken = tokenDevice ? crypto.randomUUID() : rawToken;
  const finalTokenHash = hashWithSalt(finalRawToken);

  const { data: newDevice, error: createDeviceError } = await serviceClient
    .from('devices')
    .insert({
      voter_id: voter.id,
      device_token_hash: finalTokenHash,
      fingerprint_hash: fingerprintHash,
      status: shouldFlag ? 'flagged' : 'active',
      ip_hash: ipHash,
      user_agent: userAgent,
    })
    .select('id')
    .single();

  if (createDeviceError || !newDevice) {
    return NextResponse.json(
      { error: 'Impossible de lier votre appareil.' },
      { status: 500 }
    );
  }

  await serviceClient.from('device_events').insert({
    device_id: newDevice.id,
    voter_id: voter.id,
    event_type: shouldFlag ? 'flagged' : 'linked',
    metadata: { ip_hash: ipHash, recent_ip_count: recentIpCount ?? 0 },
  });

  const response = NextResponse.json({
    bound: true,
    deviceId: newDevice.id,
    voterId: voter.id,
    conflictType: null,
    message: null,
  } satisfies DeviceBindingResult);

  response.cookies.set(DEVICE_COOKIE_NAME, finalRawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

