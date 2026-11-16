import { test, expect } from '@playwright/test';

// Shipping-label PDFs often have cut lines or borders just outside the area a
// person keeps. Those pixels must never reach the printer, not even as a thin
// smoothing/rounding sliver along the crop edge.
const CASES = [
  { size: 1000, crop: ['10', '10', '50', '50'] },
  { size: 4000, crop: ['10', '10', '50', '50'] },
  { size: 1000, crop: ['10.3', '10.7', '49.1', '37.3'] },
  { size: 2551, crop: ['10.1', '10.4', '41.3', '48.9'] },
  { size: 1733, crop: ['10.5', '11', '33.5', '45.5'] },
];
for (const { size, crop } of CASES) test(`pixels just outside the crop never print as edge lines (${size}px, ${crop.join('/')})`, async ({ page }) => {
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
  // White 1000×1000 page. The kept area is x/y 100..600. Solid black bands
  // touch it on every side, and a black block sits in its middle.
  // White page, kept area rounded outward to whole source pixels exactly as
  // the editor does. Solid black touches it on every side; a black block
  // sits in its middle.
  const data = await page.evaluate(({ n, crop }) => {
    const [l, t, w, h] = crop.map(Number).map(v => v / 100);
    const x0 = Math.floor(l * n + 1e-7), y0 = Math.floor(t * n + 1e-7);
    const x1 = Math.ceil((l + w) * n - 1e-7), y1 = Math.ceil((t + h) * n - 1e-7);
    const canvas = document.createElement('canvas'); canvas.width = n; canvas.height = n;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'black'; ctx.fillRect(0, 0, n, n);
    ctx.fillStyle = 'white'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = 'black';
    const bw = Math.round((x1 - x0) / 5), bh = Math.round((y1 - y0) / 5);
    ctx.fillRect(x0 + 2 * bw, y0 + 2 * bh, bw, bh);
    return canvas.toDataURL().split(',')[1];
  }, { n: size, crop });
  await page.getByLabel('Import artwork file').setInputFiles({ name: 'synthetic-bordered.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  await expect(page.locator('.paper-svg image')).toBeVisible();
  await page.getByRole('button', { name: 'Crop', exact: true }).click();
  await page.getByText('Fine-tune with numbers', { exact: true }).click();
  for (const [label, value] of [['Width (%)', crop[2]], ['Height (%)', crop[3]], ['Left (%)', crop[0]], ['Top (%)', crop[1]]] as const) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByRole('button', { name: 'Use crop', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await expect.poll(() => submissions.length).toBe(1);

  const pbm = Buffer.from(submissions[0].artifact.dataBase64, 'base64');
  const header = 'P4\n800 1200\n';
  expect(pbm.subarray(0, header.length).toString()).toBe(header);
  const black = (x: number, y: number) => (pbm[header.length + y * 100 + (x >> 3)] >> (7 - (x & 7))) & 1;
  // The only black inside the kept area is the middle block, so every black
  // dot must sit in one compact box. An edge sliver would stretch that box
  // across the whole frame.
  let minX = 800, minY = 1200, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < 1200; y += 1) for (let x = 0; x < 800; x += 1) {
    if (!black(x, y)) continue;
    count += 1; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  expect(count).toBeGreaterThan(1_000);
  expect(maxX - minX + 1).toBeLessThan(360);
  expect(maxY - minY + 1).toBeLessThan(360);
  expect(errors).toEqual([]);
});
