import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';

interface CreateDjBody {
  stageName?: string;
  roundId?: string;
  realName?: string;
  bio?: string;
  genre?: string;
  photoUrl?: string;
  mediaUrl?: string;
}

interface UpdateDjBody extends CreateDjBody {
  djId?: string;
}

/**
 * Enregistre un nouveau DJ avec nom de scène et prime obligatoires (FR-15)
 * et crée automatiquement son passage via `admin_create_dj`.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    return guard.response;
  }

  const body = (await request.json().catch(() => ({}))) as CreateDjBody;
  if (!body.stageName?.trim() || !body.roundId) {
    return NextResponse.json(
      { error: 'Le nom de scène et la prime sont obligatoires.' },
      { status: 400 }
    );
  }

  const { data, error } = await guard.context.userClient.rpc('admin_create_dj', {
    p_stage_name: body.stageName.trim(),
    p_round_id: body.roundId,
    p_real_name: body.realName ?? null,
    p_bio: body.bio ?? null,
    p_genre: body.genre ?? null,
    p_photo_url: body.photoUrl ?? null,
    p_media_url: body.mediaUrl ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ result: data }, { status: 201 });
}

/**
 * Modifie le nom ou les infos d'un DJ à tout moment, et sa prime uniquement
 * tant que son passage est en statut `waiting` (FR-16).
 */
export async function PATCH(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    return guard.response;
  }

  const body = (await request.json().catch(() => ({}))) as UpdateDjBody;
  if (!body.djId || !body.stageName?.trim()) {
    return NextResponse.json(
      { error: 'Identifiant du DJ et nom de scène obligatoires.' },
      { status: 400 }
    );
  }

  const { error } = await guard.context.userClient.rpc('admin_update_dj', {
    p_dj_id: body.djId,
    p_stage_name: body.stageName.trim(),
    p_round_id: body.roundId ?? null,
    p_real_name: body.realName ?? null,
    p_bio: body.bio ?? null,
    p_genre: body.genre ?? null,
    p_photo_url: body.photoUrl ?? null,
    p_media_url: body.mediaUrl ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

