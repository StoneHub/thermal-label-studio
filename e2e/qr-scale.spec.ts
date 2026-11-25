import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
// The web app owns the decoder dependency; reuse it to prove the printed label still scans.
import jsQR from '../apps/web/node_modules/jsqr';

const QR_TEXT = 'https://example.com/return/TLS-E2E-0001';

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
  await page.getByLabel('Import artwork file').setInputFiles({ name: 'synthetic-return-qr.png', mimeType: 'image/png',
    buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'synthetic-return-qr.png')) });
  await expect(page.locator('.paper-svg image')).toBeVisible();
  return { submissions, errors };
}

/** Decode the submitted 800 x 1200 PBM (set bit = black) the way a phone camera would. */
function decodeLabel(intent: any) {
  const pbm = Buffer.from(intent.artifact.dataBase64, 'base64');
  const header = Buffer.from('P4\n800 1200\n');
  const raster = pbm.subarray(header.length);
  const rgba = new Uint8ClampedArray(800 * 1200 * 4);
  let left = 800, right = 0;
  for (let y = 0; y < 1200; y += 1) for (let x = 0; x < 800; x += 1) {
    const black = (raster[y * 100 + (x >> 3)] >> (7 - (x & 7))) & 1;
    const value = black ? 0 : 255;
    rgba.set([value, value, value, 255], (y * 800 + x) * 4);
    if (black) { left = Math.min(left, x); right = Math.max(right, x); }
  }
  return { code: jsQR(rgba, 800, 1200), inkWidth: right - left + 1 };
}

test('Find QR code crops to the code and blows it up into a scannable label', async ({ page }) => {
  const mock = await setup(page);
  await page.getByRole('button', { name: 'Crop', exact: true }).click();
  await page.getByRole('button', { name: 'Find QR code', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Found a QR code' })).toContainText('example.com/return');
  await page.getByText('Fine-tune with numbers', { exact: true }).click();
  // The 116 px symbol at (300, 600) plus a 16 px quiet zone on a 720 x 1280 page.
  await expect(page.getByLabel('Left (%)', { exact: true })).toHaveValue('39.4');
  await expect(page.getByLabel('Width (%)', { exact: true })).toHaveValue('20.6');
  await page.getByRole('button', { name: 'Use crop', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await expect.poll(() => mock.submissions.length).toBe(1);
  const full = decodeLabel(mock.submissions[0]);
  expect(full.code?.data).toBe(QR_TEXT);
  // 116 of the 148 kept pixels are symbol, so the code spans about 627 of the 800 label dots.
  expect(full.inkWidth).toBeGreaterThan(615);
  expect(mock.errors).toEqual([]);
});

test('Size scales the cropped image and is one undoable edit', async ({ page }) => {
  const mock = await setup(page);
  await page.getByRole('button', { name: 'Crop', exact: true }).click();
  await page.getByRole('button', { name: 'Find QR code', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Found a QR code' })).toBeVisible();
  await page.getByRole('button', { name: 'Use crop', exact: true }).click();
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  const size = page.getByLabel('Size', { exact: true });
  await expect(size).toHaveValue('100');
  await expect(page.getByText(/Prints about 3\.9 × 3\.9 in/)).toBeVisible();
  await size.fill('50');
  await size.blur();
  await expect(page.getByText(/Prints about 2\.0 × 2\.0 in/)).toBeVisible();
  await page.getByRole('button', { name: 'Smaller', exact: true }).click();
  await expect(size).toHaveValue('40');
  await page.getByRole('button', { name: 'Close panel' }).click();

  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await expect.poll(() => mock.submissions.length).toBe(1);
  const small = decodeLabel(mock.submissions[0]);
  expect(small.code?.data).toBe(QR_TEXT);
  expect(small.inkWidth).toBeGreaterThan(240);
  expect(small.inkWidth).toBeLessThan(290);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  await expect(page.getByLabel('Size', { exact: true })).toHaveValue('50');
  await page.getByRole('button', { name: 'Largest', exact: true }).click();
  await expect(page.getByLabel('Size', { exact: true })).toHaveValue('100');
  expect(mock.errors).toEqual([]);
});
