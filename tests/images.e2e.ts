import { test, expect } from '@playwright/test';
test('customer images stay local, unique, load at 4:3 without development notices', async ({
  page,
}) => {
  const remoteImages: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'image' && new URL(r.url()).hostname !== '127.0.0.1')
      remoteImages.push(r.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/order');
  const cards = page.locator('.product-image-button img');
  await expect(cards.first()).toBeVisible();
  for (const img of await cards.all()) {
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveAttribute('data-image-source', 'original-illustration');
    await expect(img).toHaveAttribute('src', /\/menu-items\/[a-z0-9-]+-480\.webp/);
    await expect(img).toHaveAttribute('alt', /Original hand-drawn sticker illustration/);
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(480);
    const box = await img.boundingBox();
    expect(box!.width / box!.height).toBeCloseTo(4 / 3, 1);
  }
  const sources = await cards.evaluateAll((imgs) =>
    imgs.map((img) => (img as HTMLImageElement).src),
  );
  expect(new Set(sources).size).toBe(sources.length);
  await page.getByRole('button', { name: 'Add Latte', exact: true }).click();
  const detail = page.locator('.detail-image');
  await expect(detail).toHaveAttribute('src', '/menu-items/latte-960.webp');
  await expect.poll(() => detail.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(960);
  await expect(page.locator('body')).not.toContainText(
    /proposed|sample menu|local emulator|illustration purposes|prototype|mock/i,
  );
  expect(remoteImages).toEqual([]);
});

test('expanded menu filters and description search work on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/order');
  await expect(page.locator('.product-card')).toHaveCount(68);
  await page.getByRole('button', { name: 'All-Day Kitchen', exact: false }).click();
  await expect(page.locator('.product-card')).toHaveCount(22);
  await page.getByRole('button', { name: 'Vegetarian', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Bacon & Egg Roll', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Avocado Toast', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Under $10', exact: false }).click();
  for (const price of await page.locator('.product-card .price').allTextContents())
    expect(Number(price.match(/[\d.]+/)?.[0])).toBeLessThan(10);
  await page.getByRole('button', { name: 'Popular', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Latte', exact: true })).toBeVisible();
  await page
    .locator('.categories')
    .getByRole('button', { name: /^All(?:\s*↗)?$/ })
    .click();
  await page.getByLabel('Search menu').fill('citrus and tonic');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Yuzu Espresso Tonic' })).toBeVisible();
  await expect(page.getByText('No matching items. Try a different search.')).toHaveCount(0);
});

test('failed product art falls back safely without blocking ordering', async ({ page }) => {
  await page.route('**/menu-items/latte-480.webp', (route) => route.abort());
  await page.goto('/order');
  const card = page
    .locator('.product-card')
    .filter({ has: page.getByRole('heading', { name: 'Latte', exact: true }) });
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('img')).toHaveAttribute('src', '/menu-items/latte.svg');
  await expect(card.getByRole('button', { name: 'Add Latte', exact: true })).toBeEnabled();
});

test('admin can edit dietary labels and a seasonal end time', async ({ browser }) => {
  const adminContext = await browser.newContext(),
    guestContext = await browser.newContext();
  const page = await adminContext.newPage(),
    guest = await guestContext.newPage();
  await page.goto('/staff');
  await page.getByLabel('Email', { exact: true }).fill('admin@blackcherry.test');
  await page.getByLabel('Password', { exact: true }).fill('CafeDemo123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Menu & availability' }).click();
  const row = page
    .getByRole('row')
    .filter({ has: page.getByText('Strawberry Matcha Cloud', { exact: true }) });
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Vegetarian', { exact: true })).toBeChecked();
  const originalEnd = await page.getByLabel('Available until', { exact: true }).inputValue();
  try {
    await page.getByLabel('Available until', { exact: true }).fill('2026-10-01T12:00');
    await page.getByRole('button', { name: 'Save product', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await guest.goto('/order');
    await guest.getByLabel('Search menu').fill('Strawberry Matcha Cloud');
    await expect(guest.getByText('No matching items. Try a different search.')).toBeVisible();
  } finally {
    if (await page.getByRole('dialog').count())
      await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Available until', { exact: true }).fill(originalEnd);
    await page.getByRole('button', { name: 'Save product', exact: true }).click();
    await adminContext.close();
    await guestContext.close();
  }
});
