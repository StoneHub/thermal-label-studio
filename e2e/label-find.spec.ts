import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
// The web app owns the decoder dependency; reuse it to prove the printed label reads upright.
import { scanGrayBuffer, ZBarOrientation } from '../apps/web/node_modules/@undecaf/zbar-wasm';

const TRACKING = '1Z999AA10123456784';

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
  await page.getByLabel('Import artwork file').setInputFiles({ name: 'synthetic-return-page.png', mimeType: 'image/png',
    buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'synthetic-return-page.png')) });
  await expect(page.locator('.paper-svg image')).toBeVisible();
  return { submissions, errors };
}

/** Decode the submitted 800 x 1200 PBM (set bit = black) with zbar. */
async function decodeLabel(intent: any) {
  const pbm = Buffer.from(intent.artifact.dataBase64, 'base64');
  const raster = pbm.subarray(Buffer.from('P4\n800 1200\n').length);
  const gray = new Uint8Array(800 * 1200);
  for (let y = 0; y < 1200; y += 1) for (let x = 0; x < 800; x += 1) {
    gray[y * 800 + x] = (raster[y * 100 + (x >> 3)] >> (7 - (x & 7))) & 1 ? 0 : 255;
  }
  return scanGrayBuffer(gray.buffer, 800, 1200);
}

test('Find label or QR boxes a sideways shipping label, stands it upright and prints it readable', async ({ page }) => {
  const mock = await setup(page);
  await page.getByRole('button', { name: 'Crop', exact: true }).click();
  await page.getByRole('button', { name: 'Find label or QR', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Found a shipping label' }))
    .toContainText('with 3 bar codes. Turned it 90° so it reads upright.');
  await expect(page.getByRole('button', { name: 'Rotate label, now 90°' })).toBeVisible();
  await page.getByText('Fine-tune with numbers', { exact: true }).click();
  // The label's ink sits at about x 195-1017, y 438-1014 of the 1224 x 1584 page, inside the dashed cut box;
  // the address block on the left stands apart from the bar codes and must be kept. The box adds a thin margin.
  const value = async (name: string) => Number(await page.getByLabel(name, { exact: true }).inputValue());
  expect(await value('Left (%)')).toBeGreaterThan(14.5); expect(await value('Left (%)')).toBeLessThan(16);
  expect(await value('Width (%)')).toBeGreaterThan(67.5); expect(await value('Width (%)')).toBeLessThan(70.5);
  expect(await value('Top (%)')).toBeGreaterThan(26.5); expect(await value('Top (%)')).toBeLessThan(27.7);
  expect(await value('Height (%)')).toBeGreaterThan(36.3); expect(await value('Height (%)')).toBeLessThan(38.5);
  await page.getByRole('button', { name: 'Use crop', exact: true }).click();

  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await expect.poll(() => mock.submissions.length).toBe(1);
  const symbols = await decodeLabel(mock.submissions[0]);
  const tracking = symbols.find(symbol => symbol.decode() === TRACKING);
  expect(tracking, `decoded ${symbols.map(symbol => symbol.decode()).join(', ')}`).toBeTruthy();
  expect(tracking!.orientation).toBe(ZBarOrientation.ZBAR_ORIENT_UP);
  expect(mock.errors).toEqual([]);
});
