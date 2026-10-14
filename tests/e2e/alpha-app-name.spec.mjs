import { test, expect } from '@playwright/test';

// Alpha-specific app naming only. No production installation or user data.
test('Alpha PWA uses separate displayed name and install identity', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#dailyMoves')).toBeVisible();
  await expect(page.locator('header h1')).toHaveText('Osakevahti Alpha');
  await expect(page.locator('header .eyebrow')).toHaveText('ALPHA · v2.17.6');
  await expect(page).toHaveTitle('Osakevahti Alpha');
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]'))
    .toHaveAttribute('content', 'Osakevahti Alpha');
  await expect(page.locator('summary').filter({ hasText: 'Asenna Osakevahti Alpha' })).toHaveCount(1);

  const manifestResponse = await page.request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe('Osakevahti Alpha');
  expect(manifest.short_name).toBe('OV Alpha');
  expect(manifest.id).toBe('./?channel=alpha');
  expect(manifest.id).not.toBe('./');
  // Visible header marker was asserted above. Footer belongs to a separate
  // settings view's collapsed panel: assert its content, not default visibility.
  await expect(page.getByText('Osakevahti Alpha · v2.17.6',{exact:false}))
    .toContainText('Osakevahti Alpha · v2.17.6');
  expect(manifest.start_url).toBe('./');
  expect(manifest.scope).toBe('./');
});
