import { test, expect, type Page } from '@playwright/test';
async function login(page: Page, admin = false) {
  await page.goto('/staff');
  await page
    .getByLabel('Email', { exact: true })
    .fill(admin ? 'admin@blackcherry.test' : 'staff@blackcherry.test');
  await page.getByLabel('Password', { exact: true }).fill('CafeDemo123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'On the counter.' })).toBeVisible();
}
test('mobile customer order → authenticated staff board → live customer completion', async ({
  browser,
}) => {
  const customer = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const team = await browser.newContext();
  const page = await customer.newPage(),
    staff = await team.newPage();
  await page.goto('/order?source=qr&table=3');
  await expect(page.getByRole('heading', { name: 'On the menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Latte', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Oat', { exact: false }).check();
  await page.getByRole('dialog').getByLabel('Extra Shot', { exact: false }).check();
  await page.getByRole('button', { name: 'Add to order' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Open cart, 1 items' }).click();
  await page.getByLabel('Takeaway', { exact: true }).check();
  await page.getByLabel('Pickup name').fill('E2E Jo');
  await page.reload();
  await page.getByRole('button', { name: 'Open cart, 1 items' }).click();
  await expect(page.getByLabel('Takeaway', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Pickup name')).toHaveValue('E2E Jo');
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('$6.60');
  await page.getByRole('button', { name: 'Confirm & place order' }).click();
  await expect(page).toHaveURL(/\/track\/[a-f0-9]{64}$/);
  const number = (await page.locator('.order-number').textContent())!;
  await expect(page.getByTestId('tracking-status')).toHaveText('Pending');
  await login(staff);
  const card = staff.getByTestId(`order-${number}`);
  await expect(card).toBeVisible();
  await expect(card).toContainText('Oat');
  await expect(card).toContainText('Extra Shot');
  await card.getByRole('button', { name: 'Mark paid', exact: true }).click();
  await expect(card).toContainText('Undo paid');
  for (const state of ['Confirmed', 'Preparing', 'Ready']) {
    await card.getByRole('button', { name: state, exact: true }).click();
    await expect(page.getByTestId('tracking-status')).toHaveText(state);
  }
  staff.once('dialog', (d) => d.accept());
  await card.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.getByTestId('tracking-status')).toHaveText('Completed');
  await page.reload();
  await expect(page.getByTestId('tracking-status')).toHaveText('Completed');
  await page.getByLabel('Your thoughts').fill('Great oat latte.');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByRole('status')).toContainText('Thanks');
  await staff.getByLabel('Status', { exact: true }).selectOption('Completed');
  await expect(card).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await customer.close();
  await team.close();
});
test('admin edits menu, downloads QR formats and exports analytics', async ({ page }) => {
  await login(page, true);
  await page.getByRole('link', { name: 'Menu & availability' }).click();
  const row = page.getByRole('row').filter({ has: page.getByText('Latte', { exact: true }) });
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Base price (AUD)').fill('5.2');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(row).toContainText('$5.20');
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Base price (AUD)').fill('5');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(row).toContainText('$5.00');
  await row.getByRole('button', { name: 'Sell out', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Make available' })).toBeVisible();
  await row.getByRole('button', { name: 'Make available' }).click();
  await page.getByRole('link', { name: 'Table QR codes' }).click();
  await page.getByLabel('Table number', { exact: true }).fill('12');
  await expect(page.locator('.qr-url')).toContainText('table=12');
  for (const format of ['PNG', 'SVG']) {
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${format}` }).click();
    expect((await promise).suggestedFilename()).toBe(`black-cherry-12.${format.toLowerCase()}`);
  }
  await page.emulateMedia({ media: 'print' });
  const printCard = page.locator('.table-card');
  const printSize = await printCard.evaluate((el) => ({
    height: el.clientHeight,
    content: el.scrollHeight,
  }));
  expect(printSize.content).toBeLessThanOrEqual(printSize.height);
  await printCard.screenshot({ path: 'test-results/table-card-a6.png' });
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('link', { name: 'Insights', exact: true }).click();
  await expect(page.getByText('Order value', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export orders', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/orders-.*csv/);
});
test('guest cannot access API staff operations and mobile/tablet layouts fit', async ({
  page,
  request,
}) => {
  const response = await request.post('/api/service?op=update', { data: { id: 'fake' } });
  expect(response.status()).toBe(401);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/order');
    await expect(page.getByRole('heading', { name: 'On the menu' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.screenshot({ path: `test-results/menu-${width}.png`, fullPage: true });
    if (width === 1440) await page.screenshot({ path: 'test-results/menu-desktop.png' });
  }
});

test('availability edits synchronize to an open customer menu', async ({ browser }) => {
  const team = await browser.newContext(),
    customer = await browser.newContext();
  const staff = await team.newPage(),
    guest = await customer.newPage();
  await login(staff, true);
  await staff.getByRole('link', { name: 'Menu & availability' }).click();
  await guest.goto('/order');
  const row = staff.getByRole('row').filter({ has: staff.getByText('Latte', { exact: true }) });
  const card = guest
    .locator('.product-card')
    .filter({ has: guest.getByRole('heading', { name: 'Latte', exact: true }) });
  await expect(card.getByRole('button', { name: 'Add Latte', exact: true })).toBeEnabled();
  try {
    await row.getByRole('button', { name: 'Sell out', exact: true }).click();
    await expect(card).toContainText('SOLD OUT');
    await expect(card.getByRole('button', { name: 'Add Latte', exact: true })).toBeDisabled();
    await row.getByRole('button', { name: 'Make available', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Add Latte', exact: true })).toBeEnabled();
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    await staff.getByRole('combobox', { name: 'Availability', exact: true }).selectOption('Hidden');
    await staff.getByRole('button', { name: 'Save product', exact: true }).click();
    await expect(card).toHaveCount(0);
  } finally {
    if (await staff.getByRole('dialog').count())
      await staff.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    await staff
      .getByRole('combobox', { name: 'Availability', exact: true })
      .selectOption('Available');
    await staff.getByRole('button', { name: 'Save product', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Add Latte', exact: true })).toBeEnabled();
    await team.close();
    await customer.close();
  }
});

test('staff cancellation immediately updates customer tracking', async ({ browser }) => {
  const customer = await browser.newContext(),
    team = await browser.newContext();
  const page = await customer.newPage(),
    staff = await team.newPage();
  await page.goto('/order?source=qr&table=8');
  await page.getByRole('button', { name: 'Add Latte', exact: true }).click();
  await page.getByRole('button', { name: /^Add to order/ }).click();
  await page.getByRole('button', { name: 'Open cart, 1 items' }).click();
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm & place order', exact: true }).click();
  await expect(page).toHaveURL(/\/track\/[a-f0-9]{64}$/);
  const number = (await page.locator('.order-number').textContent())!;
  await login(staff);
  const card = staff.getByTestId(`order-${number}`);
  await card.locator('summary').click();
  staff.once('dialog', (d) => d.accept());
  await card.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await expect(page.getByTestId('tracking-status')).toHaveText('Cancelled');
  await page.reload();
  await expect(page.getByTestId('tracking-status')).toHaveText('Cancelled');
  await customer.close();
  await team.close();
});
