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
  // A small source enlarged onto the label leaked on every run before the fix.
  { size: 200, crop: ['10.3', '10.7', '49.1', '37.3'] },
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
  await expect(page.getByRole('toolbar', { name: 'Crop tools' })).not.toBeVisible();
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

// Independent of any one rasterizer's smoothing: the bitmap handed to print
// preparation holds exactly the kept pixels and nothing else.
test('print preparation receives only the kept pixels', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { bakeImageCrops } = await import('/src/lib/printCrop.ts');
    const canvas = document.createElement('canvas'); canvas.width = 50; canvas.height = 40;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'black'; ctx.fillRect(0, 0, 50, 40);
    ctx.fillStyle = 'white'; ctx.fillRect(7, 5, 21, 13);
    const source = canvas.toDataURL();
    const crop = { x: 7, y: 5, width: 21, height: 13, sourceWidth: 50, sourceHeight: 40 };
    const label = { id: 'd', name: 'd', schemaVersion: 1, revision: 1, size: { width: 800, height: 1200 },
      elements: [{ id: 'i', type: 'image', x: 0, y: 0, width: 800, height: 1200, source, crop, fit: 'contain' }] };
    const baked = (await bakeImageCrops(label as any)).elements[0] as any;
    const image = new Image(); image.src = baked.source; await image.decode();
    const check = Object.assign(document.createElement('canvas'), { width: image.naturalWidth, height: image.naturalHeight });
    const c = check.getContext('2d')!; c.drawImage(image, 0, 0);
    const pixels = c.getImageData(0, 0, check.width, check.height).data;
    let dark = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 255) dark += 1;
    return { width: image.naturalWidth, height: image.naturalHeight, dark, crop: baked.crop, original: label.elements[0].source === source };
  });
  expect(result).toEqual({ width: 21, height: 13, dark: 0, crop: { x: 0, y: 0, width: 21, height: 13, sourceWidth: 21, sourceHeight: 13 }, original: true });
});
