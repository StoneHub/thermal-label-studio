import { test, expect, type Page } from '@playwright/test';

// ASCII-only, deterministic 4×6 PDF; no personal labels or external fixture dependency.
function labelsPdf(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>',
  ];
  for (let index = 0; index < 3; index++) {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 288 432] /Resources << /Font << /F1 9 0 R >> >> /Contents ${4 + index * 2} 0 R >>`);
    const content = `BT /F1 26 Tf 24 350 Td (SYNTHETIC ${index + 1}) Tj ET\n24 100 ${40 + index * 30} 100 re f\n`;
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`);
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let source = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(source));
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(source);
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  source += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(source);
}

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) console.log('SYNTHETIC_FAILURE_DOM', (await page.locator('body').innerText()).slice(0, 12000));
});

async function setup(page: Page) {
  page.on('pageerror', error => console.log('BROWSER_ERROR', error.message));
  page.on('console', message => { if (message.type() === 'error' || message.text().startsWith('IMPORT_STATUS')) console.log('BROWSER_CONSOLE', message.text()); });
  const submissions: any[] = [];
  const unexpected: string[] = [];
  let release: (() => void) | undefined;
  let hold = false;
  let rejectAt = 0;
  let disconnectAt = 0;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:5173') {
      unexpected.push(url.href); await route.abort(); return;
    }
    if (url.pathname === '/api/status') {
      await route.fulfill({ json: { service: 'fleet-print-node', printerProfileId: 'phomemo-pm241bt-4x6', label: { ready: true, configured: true, usbPresent: true, detail: 'Synthetic mock only' } } });
    } else if (url.pathname === '/api/artwork') {
      await route.fulfill({ status: route.request().method() === 'POST' ? 503 : 200, json: { items: [], detail: 'Synthetic history unavailable' } });
    } else if (url.pathname === '/api/print-label-image') {
      const intent = route.request().postDataJSON();
      submissions.push(intent);
      if (hold) await new Promise<void>(resolve => { release = resolve; });
      if (disconnectAt === submissions.length) { await route.abort(); return; }
      const rejected = rejectAt === submissions.length;
      await route.fulfill({ status: rejected ? 503 : 200, json: { taskId: intent.taskId, accepted: !rejected, state: rejected ? 'rejected' : 'accepted', detail: rejected ? 'Synthetic failure' : 'Synthetic acceptance' } });
    } else if (url.pathname.startsWith('/api/')) {
      unexpected.push(url.href); await route.abort();
    } else await route.continue();
  });
  await page.goto('/');
  await page.evaluate(() => {
    let previous = '';
    new MutationObserver(() => {
      const status = document.querySelector('.status-message')?.textContent ?? '';
      if (status && status !== previous) console.log('IMPORT_STATUS', status);
      previous = status;
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await page.getByLabel('Import artwork file').setInputFiles({ name: 'synthetic-labels.pdf', mimeType: 'application/pdf', buffer: labelsPdf() });
  await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
  return { submissions, unexpected, hold: () => { hold = true; }, release: () => { hold = false; release?.(); }, rejectSecond: () => { rejectAt = 2; }, disconnectSecond: () => { disconnectAt = 2; } };
}

async function screenshot(page: Page, name: string) {
  const png = await page.screenshot({ scale: 'css' });
  expect(png.length).toBeLessThan(200_000);
  // Logs are not billed artifact storage. Chunked markers permit lossless retrieval.
  console.log(`SYNTHETIC_PNG_BEGIN ${name}`);
  for (const chunk of png.toString('base64').match(/.{1,4000}/g) ?? []) console.log(`SYNTHETIC_PNG_DATA ${chunk}`);
  console.log(`SYNTHETIC_PNG_END ${name}`);
}

test('mobile carousel, fill default, selected print and duplicate guard', async ({ page }) => {
  const mock = await setup(page);
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next page preview', exact: true })).toBeVisible();
  await expect(page.locator('.paper-svg image')).toHaveAttribute('preserveAspectRatio', 'xMidYMid slice');
  await screenshot(page, 'first-page');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous page preview', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next page preview', exact: true })).toBeVisible();
  mock.hold();
  await page.getByRole('button', { name: 'Print this page', exact: true }).click();
  await expect.poll(() => mock.submissions.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Printing…', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Printing…', exact: true }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  const artworkBeforeUndo = await page.locator('.paper-svg').innerHTML();
  await page.keyboard.press('Control+z');
  expect(await page.locator('.paper-svg').innerHTML()).toBe(artworkBeforeUndo);
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  expect(mock.submissions).toHaveLength(1);
  expect(mock.submissions[0].maxAttempts).toBe(1);
  mock.release();
  await expect(page.getByText('1 label(s) accepted by the print node.', { exact: false })).toBeVisible();
  await screenshot(page, 'middle-page');
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByRole('button', { name: 'Print this page', exact: true }).click();
  await expect.poll(() => mock.submissions.length).toBe(2);
  // The earlier selected middle page contains a larger bar than page one.
  expect(mock.submissions[0].artifact.blackPixelCount).toBeGreaterThan(mock.submissions[1].artifact.blackPixelCount);
  expect(mock.unexpected).toEqual([]);
});

test('cancel all sends nothing; accepted all is ordered and one attempt per page', async ({ page }) => {
  const mock = await setup(page);
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Print all 3 pages…' }).click();
  await expect(page.getByRole('button', { name: 'Print this page', exact: true })).toBeEnabled();
  expect(mock.submissions).toHaveLength(0);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Print all 3 pages…' }).click();
  await expect(page.getByText('3 label(s) accepted by the print node.', { exact: false })).toBeVisible();
  expect(mock.submissions).toHaveLength(3);
  expect(new Set(mock.submissions.map(item => item.artifact.sha256)).size).toBe(3);
  expect(new Set(mock.submissions.map(item => item.taskId)).size).toBe(3);
  // Each synthetic page has a deliberately wider black bar, proving page order.
  expect(mock.submissions[0].artifact.blackPixelCount).toBeLessThan(mock.submissions[1].artifact.blackPixelCount);
  expect(mock.submissions[1].artifact.blackPixelCount).toBeLessThan(mock.submissions[2].artifact.blackPixelCount);
  expect(mock.submissions.every(item => item.maxAttempts === 1)).toBe(true);
  expect(mock.unexpected).toEqual([]);
});

for (const disconnect of [false, true]) test(`batch stops after ${disconnect ? 'lost connection' : 'rejected receipt'} without retrying or sending third`, async ({ page }) => {
  const mock = await setup(page);
  if (disconnect) mock.disconnectSecond(); else mock.rejectSecond();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Print all 3 pages…' }).click();
  await expect(page.getByText(disconnect ? /connection was lost/ : /Synthetic failure/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print this page', exact: true })).toBeEnabled();
  expect(mock.submissions).toHaveLength(2);
  expect(mock.unexpected).toEqual([]);
});
