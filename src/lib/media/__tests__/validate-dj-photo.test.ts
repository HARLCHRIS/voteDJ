import { describe, expect, it } from 'vitest';
import { validateDjPhotoMeta } from '@/lib/media/validate-dj-photo';

describe('validateDjPhotoMeta', () => {
  it('accepte un PNG ou WebP >= 1200px de hauteur et < 300 Ko', () => {
    expect(
      validateDjPhotoMeta({
        mimeType: 'image/webp',
        sizeBytes: 180 * 1024,
        width: 900,
        height: 1200,
      })
    ).toEqual({
      valid: true,
      width: 900,
      height: 1200,
      sizeBytes: 180 * 1024,
    });
  });

  it('refuse un JPEG', () => {
    const res = validateDjPhotoMeta({
      mimeType: 'image/jpeg',
      sizeBytes: 120 * 1024,
      width: 900,
      height: 1400,
    });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toContain('PNG ou WebP');
    }
  });

  it('refuse une image >= 300 Ko', () => {
    const res = validateDjPhotoMeta({
      mimeType: 'image/png',
      sizeBytes: 310 * 1024,
      width: 900,
      height: 1400,
    });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toContain('300 Ko');
    }
  });

  it('refuse une hauteur < 1200 px', () => {
    const res = validateDjPhotoMeta({
      mimeType: 'image/webp',
      sizeBytes: 150 * 1024,
      width: 800,
      height: 1199,
    });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toContain('1 200 px');
    }
  });
});

