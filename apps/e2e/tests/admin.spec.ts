import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'correct horse battery staple';

// Smallest valid 1x1 transparent PNG — exercises the real header-based
// dimension reader (see apps/api/src/lib/imageMeta.ts) without a fixture file.
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

// One linear journey rather than independent tests: each `test()` gets its
// own browser context (no shared cookies), but the flow itself is inherently
// sequential — you can't "just" test editing a post without first having
// registered and created one. `test.step` keeps the steps reported
// separately without paying for a fresh, signed-out context each time.
test('admin: register, sign out/in, publish a post, upload media', async ({ page }) => {
  await test.step('registers the first admin account', async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Create your admin account' })).toBeVisible();

    await page.getByLabel('Name').fill('E2E Admin');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByRole('link', { name: 'Posts', exact: true })).toBeVisible();
  });

  await test.step('signs out and back in', async () => {
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('link', { name: 'Posts', exact: true })).toBeVisible();
  });

  await test.step('creates and publishes a post', async () => {
    await page.goto('/collections/posts/new');
    // `#title` (not getByLabel) — the SEO fields this collection injects
    // include a "Meta title" field, an ambiguous substring match otherwise.
    await page.locator('#title').fill('My First E2E Post');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.badge-published')).toBeVisible();

    await page.goto('/collections/posts');
    await expect(page.getByRole('link', { name: 'My First E2E Post' })).toBeVisible();
  });

  await test.step('edits the post back to a draft', async () => {
    await page.getByRole('link', { name: 'My First E2E Post' }).click();
    await page.locator('#title').fill('My First E2E Post (edited)');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.locator('.badge-draft')).toBeVisible();

    await page.goto('/collections/posts');
    await expect(page.getByRole('link', { name: 'My First E2E Post (edited)' })).toBeVisible();
  });

  await test.step('uploads media', async () => {
    await page.goto('/media');
    await expect(page.getByText('No files yet.')).toBeVisible();

    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: TEST_PNG });

    await expect(page.getByText('pixel.png')).toBeVisible();
    await expect(page.getByText('1×1')).toBeVisible();
  });
});
