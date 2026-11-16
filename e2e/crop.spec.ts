import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page) {
  const submissions: any[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:5173') return route.abort();
    if (url.pathname === '/api/status') return route.fulfill({ json: { service: 'fleet-print-node', printerProfileId: 'phomemo-pm241bt-4x6', label: { ready: true, configured: true, usbPresent: true, detail: 'Mock printer' } } });
    if (url.pathname === '/api/artwork') return route.fulfill({ status: route.request().method() === 'POST' ? 503 : 200, json: { items: [] } });
    if (url.pathname === '/api/print-label-image') {
      const intent = route.request().postDataJSON(); submissions.push(intent);
      return route.fulfill({ json: { taskId: intent.taskId, accepted: true, state: 'accepted', detail: 'Mock only' } });
    }
    return route.continue();
  });
  await page.goto('/');
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 800;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 600, 800);
    ctx.fillStyle = 'black'; ctx.fillRect(100, 50, 200, 100); ctx.fillRect(0, 400, 600, 400);
    return canvas.toDataURL().split(',')[1];
  });
  await page.getByLabel('Import artwork file').setInputFiles({ name: 'synthetic-return.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  await expect(page.locator('.paper-svg image')).toBeVisible();
  return { submissions, errors };
}

async function topHalf(page: Page) {
  await page.getByRole('button', { name: 'Crop', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Crop to the label' })).toBeVisible();
  await page.getByText('Fine-tune with numbers', { exact: true }).click();
  await page.getByLabel('Height (%)', { exact: true }).fill('50');
}

test('crop preview and print use only the kept area; reset, cancel, undo and rotation work', async ({ page }) => {
  const mock = await setup(page);
  const before = await page.locator('.paper-svg').innerHTML();
  await topHalf(page);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.locator('.paper-svg').innerHTML()).toBe(before);
  await topHalf(page);
  await page.getByRole('button', { name: 'Use crop', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const cropped = await page.locator('.paper-svg').innerHTML();
  expect(cropped).not.toBe(before);
  // Nested crop SVGs must retain their own viewport sizes, not inherit label CSS.
  const sizes = await page.locator('.paper-svg svg').evaluateAll(nodes => nodes.map(node => ({ attr: node.getAttribute('width'), css: getComputedStyle(node).width })));
  expect(sizes.length).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await expect.poll(() => mock.submissions.length).toBe(1);
  expect(mock.submissions[0].artifact.blackPixelCount).toBeGreaterThan(34_000);
  expect(mock.submissions[0].artifact.blackPixelCount).toBeLessThan(37_000);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await page.locator('.paper-svg').innerHTML()).not.toContain('viewBox="0 0 600 400"');
  await page.keyboard.press('Control+Shift+z');
  expect(await page.locator('.paper-svg').innerHTML()).toBe(cropped);
  await page.getByRole('button', { name: 'Crop', exact: true }).click();
  await page.getByRole('button', { name: 'Rotate label' }).click();
  await page.getByRole('button', { name: 'Use crop' }).click();
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await expect.poll(() => mock.submissions.length).toBe(2);
  expect(mock.submissions[1].artifact.blackPixelCount).toBe(80_000);
  await page.getByRole('button', { name: 'Crop', exact: true }).click();
  await page.getByRole('button', { name: 'Reset to full page' }).click();
  await page.getByRole('button', { name: 'Use crop' }).click();
  await expect(page.locator('.paper-svg image')).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
  expect(await page.locator('.paper-svg svg').count()).toBe(1);
  expect(mock.errors).toEqual([]);
});

test('drag crop, move, resize and interruption stay bounded on a phone', async ({ page }) => {
  const mock = await setup(page);
  await page.getByRole('button', { name: 'Crop', exact: true }).click();
  const box = (await page.locator('.crop-surface').boundingBox())!;
  await page.mouse.move(box.x + box.width * .1, box.y + box.height * .1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .9, box.y + box.height * .45, { steps: 8 });
  await page.mouse.up();
  await page.getByText('Fine-tune with numbers', { exact: true }).click();
  await expect(page.getByLabel('Height (%)', { exact: true })).toHaveValue('35');
  const selection = page.locator('.crop-selection');
  await selection.focus(); await page.keyboard.press('ArrowDown');
  await expect(page.getByLabel('Top (%)', { exact: true })).toHaveValue('10.5');
  const bottom = page.getByRole('button', { name: 'Adjust crop bottom', exact: true });
  await bottom.focus(); await page.keyboard.press('ArrowUp');
  await expect(page.getByLabel('Height (%)', { exact: true })).toHaveValue('34.5');
  const initialStyle = await selection.getAttribute('style');
  const surface = page.locator('.crop-surface');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * .2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .6, box.y + box.height * .25);
  await surface.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
  await page.mouse.up();
  expect(await selection.getAttribute('style')).toBe(initialStyle);
  // Global editor shortcuts must not mutate the document behind this modal.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.paper-svg image')).toBeVisible();
  expect(mock.submissions).toHaveLength(0);
  expect(mock.errors).toEqual([]);
});

test('touch selection and preview match the committed mixed-content label', async ({ page, context }) => {
  const mock = await setup(page);
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await page.getByLabel('Label text').fill('Wide WWW letters and thin iii letters should wrap exactly the same in every preview.');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.locator('.paper-svg image').click({ position: { x: 10, y: 10 } });
  await page.getByRole('button', { name: 'Crop', exact: true }).click();
  const box = (await page.locator('.crop-surface').boundingBox())!;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * .1, y: box.y + box.height * .1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * .9, y: box.y + box.height * .45 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.getByText('Fine-tune with numbers', { exact: true }).click();
  await expect(page.getByLabel('Width (%)', { exact: true })).toHaveValue('80');
  const preview = await page.locator('.crop-preview').innerHTML();
  await page.getByRole('button', { name: 'Use crop' }).click();
  expect(await page.locator('.paper-svg').innerHTML()).toBe(preview);
  expect(mock.errors).toEqual([]);
  expect(mock.submissions).toHaveLength(0);
});
