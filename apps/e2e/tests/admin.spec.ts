import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'correct horse battery staple';
const SECOND_EMAIL = 'author@e2e.test';
const SECOND_PASSWORD = 'another horse battery staple';

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
  let postId = '';

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
    // `description` and `pillar` are also required on this collection's
    // moneyinsider-specific schema — publish is rejected without them.
    await page.locator('#description').fill('An E2E test post.');
    await page.locator('#pillar').selectOption('first-job');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.badge-published')).toBeVisible();
    postId = page.url().split('/').pop()!;
    expect(postId).toMatch(/^[0-9a-f-]{36}$/);

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

  await test.step('drag-reorders repeater rows', async () => {
    await page.goto(`/collections/posts/${postId}`);
    // FieldInput's label() just capitalizes the field name's first letter (no
    // camelCase humanizing), so "faq" renders as "Faq".
    const repeaterField = page.locator('.field').filter({ hasText: 'Faq' });
    const addButton = repeaterField.getByRole('button', { name: '+ Add Faq' });
    await addButton.click();
    await addButton.click();

    const rows = repeaterField.locator('.card');
    await expect(rows).toHaveCount(2);
    await rows.nth(0).locator('#question').fill('First question?');
    await rows.nth(0).locator('#answer').fill('First answer.');
    await rows.nth(1).locator('#question').fill('Second question?');
    await rows.nth(1).locator('#answer').fill('Second answer.');

    // Native HTML5 drag-and-drop (see apps/admin/src/lib/dragReorder.ts).
    // Playwright's locator.dragTo() doesn't reliably synthesize real
    // dragstart/dragover/drop DOM events against this handler in this
    // browser build, so dispatch them directly — drag the first row's grip
    // handle onto the second row to swap them.
    await page.evaluate(async () => {
      const cards = [...document.querySelectorAll('.card')].filter((c) =>
        c.querySelector(':scope > [title="Drag to reorder"]'),
      );
      const source = cards[0]!.querySelector('[title="Drag to reorder"]')!;
      const target = cards[1]!;
      const dataTransfer = new DataTransfer();
      const fire = (el: Element, type: string) =>
        el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
      fire(source, 'dragstart');
      await new Promise((r) => setTimeout(r, 50));
      fire(target, 'dragover');
      fire(target, 'drop');
      fire(source, 'dragend');
    });

    await expect(rows.nth(0).locator('#question')).toHaveValue('Second question?');
    await expect(rows.nth(1).locator('#question')).toHaveValue('First question?');

    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.locator('.badge-draft')).toBeVisible();
  });

  await test.step('opens live preview', async () => {
    // Scoped to .page-header — the block (rich text) editor has its own
    // "Preview" toggle button too, an ambiguous match otherwise.
    await page.locator('.page-header').getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByRole('button', { name: '← Back to editor' })).toBeVisible();
    // Doesn't assert the iframe's rendered content — the example front-end
    // this points at isn't part of the E2E harness — only that a real
    // preview token was minted and templated into the URL correctly.
    await expect(page.locator('iframe[title="Live preview"]')).toHaveAttribute(
      'src',
      /\/preview\/posts\/[0-9a-f-]{36}\?token=.+/,
    );
    await page.getByRole('button', { name: '← Back to editor' }).click();
  });

  await test.step('invites a second user', async () => {
    await page.goto('/users');
    await page.getByRole('button', { name: '+ Invite user' }).click();
    await page.locator('#invite-email').fill(SECOND_EMAIL);
    await page.locator('#invite-password').fill(SECOND_PASSWORD);
    await page.getByRole('button', { name: 'Create user' }).click();
    await expect(page.getByText(SECOND_EMAIL)).toBeVisible();
  });

  await test.step('shows presence when a second user opens the same entry', async () => {
    const context2 = await page.context().browser()!.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/');
    await page2.getByLabel('Email').fill(SECOND_EMAIL);
    await page2.getByLabel('Password').fill(SECOND_PASSWORD);
    await page2.getByRole('button', { name: 'Sign in' }).click();
    await expect(page2.getByRole('link', { name: 'Posts', exact: true })).toBeVisible();

    await page2.goto(`/collections/posts/${postId}`);
    await expect(page2.locator('#title')).toHaveValue('My First E2E Post (edited)');

    // The admin's own presence heartbeat loop is on an 8s interval — reload
    // to pick up the second user's heartbeat immediately instead of waiting.
    await page.goto(`/collections/posts/${postId}`);
    await expect(page.getByText(SECOND_EMAIL, { exact: false })).toBeVisible({ timeout: 15_000 });

    await context2.close();
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
