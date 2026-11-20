import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

test.describe('Sécurité API & Confidentialité', () => {
  test('bloque les routes sensibles sans authentification', async ({
    request,
  }) => {
    const adminRes = await request.get('/api/admin/dashboard');
    expect(adminRes.status()).toBe(401);

    const scoreRes = await request.post('/api/scores/submit', {
      data: { performanceId: '00000000-0000-0000-0000-000000000000', score: 8 },
    });
    expect(scoreRes.status()).toBe(401);

    const bindRes = await request.post('/api/device/bind', {
      data: { deviceToken: 'test-token-1234567890' },
    });
    expect(bindRes.status()).toBe(401);
  });

  test('/api/live-status retourne le DJ en direct sans aucun score public', async ({
    request,
  }) => {
    const res = await request.get('/api/live-status');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('activeRound');
    expect(body).toHaveProperty('openPerformance');
    expect(JSON.stringify(body)).not.toContain('scores_sum');
    expect(JSON.stringify(body)).not.toContain('public_avg');
  });
});

test.describe('Parcours Public & Mobile /vote', () => {
  for (const vp of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    test(`affiche /vote en plein écran sans débordement à ${vp.width}x${vp.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(vp);
      await page.goto('/vote');

      await expect(page.getByText('VOTE', { exact: true })).toBeVisible();
      await expect(page.getByText('#DJCHALLENGE')).toBeVisible();
      await expect(
        page.getByRole('button', { name: /SE CONNECTER AVEC GOOGLE/i })
      ).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow).toBe(false);
    });
  }

  test('détecte le navigateur intégré WhatsApp et bloque la connexion Google', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 WhatsApp/2.24.1',
    });
    const page = await context.newPage();
    await page.goto('/vote');

    await expect(
      page.getByText(/Ouvrez ce lien dans Chrome ou Safari/i)
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Copier le lien/i })
    ).toBeVisible();
    await context.close();
  });

  test('ouvre les 5 boutons ronds >= 56px au tap sur NOTER et affiche TA NOTE : 8', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/vote?preview=open&dj=1');

    const noterBtn = page.getByRole('button', { name: /^NOTER$/i });
    await expect(noterBtn).toBeVisible();
    await noterBtn.click();

    const group = page.getByRole('group', {
      name: /Choisir une note de 2 à 10/i,
    });
    await expect(group).toBeVisible();

    for (const val of [2, 4, 6, 8, 10]) {
      const btn = page.getByRole('button', {
        name: `Attribuer la note ${val} sur 10`,
      });
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(56);
      expect(box?.height).toBeGreaterThanOrEqual(56);
    }

    await page.getByRole('button', { name: 'Attribuer la note 8 sur 10' }).click();
    await expect(group).toBeHidden();
    await expect(
      page.getByRole('button', { name: /TA NOTE : 8/i })
    ).toBeVisible();
  });
});

test.describe('Parcours Admin /admin', () => {
  test('connexion Régie, affichage tableau de bord, export CSV et blocage vote admin', async ({
    page,
  }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      'Définir E2E_ADMIN_EMAIL et E2E_ADMIN_PASSWORD pour exécuter le test admin.'
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/admin/login');

    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Accéder à la régie/i }).click();

    await page.waitForURL('**/admin');
    await expect(
      page.getByRole('heading', { name: /Tableau de bord DJ Challenge/i })
    ).toBeVisible();
    await expect(page.getByText('DJ KEROZEN').first()).toBeVisible();

    // Vérifier l'export CSV autorisé pour la session admin
    const exportRes = await page.request.get('/api/admin/export?type=results');
    expect(exportRes.status()).toBe(200);
    const csvText = await exportRes.text();
    expect(csvText).toContain('DJ KEROZEN');

    // Un compte admin ne doit pas pouvoir voter sur /vote
    await page.goto('/vote');
    await expect(
      page.getByText(/Session administrateur Régie active/i)
    ).toBeVisible();
  });
});

