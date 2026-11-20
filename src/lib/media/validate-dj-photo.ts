export const DJ_PHOTO_MAX_BYTES = 300 * 1024; // 300 Ko
export const DJ_PHOTO_MIN_HEIGHT = 1200; // 1 200 px
export const DJ_PHOTO_ALLOWED_MIME_TYPES = ['image/png', 'image/webp'] as const;

export interface DjPhotoMetaInput {
  mimeType: string;
  sizeBytes: number;
  height: number;
  width: number;
}

export type DjPhotoValidationResult =
  | {
      valid: true;
      width: number;
      height: number;
      sizeBytes: number;
    }
  | {
      valid: false;
      error: string;
    };

/**
 * Valide les contraintes techniques d'une photo détourée de DJ :
 * format PNG ou WebP, poids < 300 Ko et hauteur >= 1 200 px.
 */
export function validateDjPhotoMeta(
  meta: DjPhotoMetaInput
): DjPhotoValidationResult {
  if (
    !DJ_PHOTO_ALLOWED_MIME_TYPES.includes(
      meta.mimeType as (typeof DJ_PHOTO_ALLOWED_MIME_TYPES)[number]
    )
  ) {
    return {
      valid: false,
      error:
        'Format non autorisé. Utilisez uniquement une image PNG ou WebP à fond transparent.',
    };
  }

  if (meta.sizeBytes >= DJ_PHOTO_MAX_BYTES) {
    const ko = Math.round(meta.sizeBytes / 1024);
    return {
      valid: false,
      error: `Fichier trop lourd (${ko} Ko). La photo doit peser moins de 300 Ko.`,
    };
  }

  if (meta.height < DJ_PHOTO_MIN_HEIGHT) {
    return {
      valid: false,
      error: `Hauteur insuffisante (${meta.height} px). La photo détourée doit mesurer au moins 1 200 px de hauteur.`,
    };
  }

  return {
    valid: true,
    width: meta.width,
    height: meta.height,
    sizeBytes: meta.sizeBytes,
  };
}

/**
 * Lit un fichier image côté navigateur, vérifie son format, son poids et ses dimensions
 * puis retourne un aperçu Data URL si toutes les contraintes sont respectées.
 */
export async function validateAndReadDjPhotoFile(
  file: File
): Promise<
  (DjPhotoValidationResult & { previewUrl?: string })
> {
  if (
    !DJ_PHOTO_ALLOWED_MIME_TYPES.includes(
      file.type as (typeof DJ_PHOTO_ALLOWED_MIME_TYPES)[number]
    )
  ) {
    return {
      valid: false,
      error:
        'Format non autorisé. Utilisez uniquement une image PNG ou WebP à fond transparent.',
    };
  }

  if (file.size >= DJ_PHOTO_MAX_BYTES) {
    const ko = Math.round(file.size / 1024);
    return {
      valid: false,
      error: `Fichier trop lourd (${ko} Ko). La photo doit peser moins de 300 Ko.`,
    };
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });

  const dimensions = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      const img = new window.Image();
      img.onload = () =>
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () =>
        reject(new Error('Image corrompue ou illisible.'));
      img.src = dataUrl;
    }
  );

  const check = validateDjPhotoMeta({
    mimeType: file.type,
    sizeBytes: file.size,
    width: dimensions.width,
    height: dimensions.height,
  });

  if (!check.valid) {
    return check;
  }

  return {
    ...check,
    previewUrl: dataUrl,
  };
}

