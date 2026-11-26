import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const output = 'visual-review';
const base = 'http://127.0.0.1:5173/'; // Ark explicitly uses mock mode on this port.
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { stdio: 'inherit' });
let browser;
const report = { commit: process.env.ARK_HEAD_SHA || process.env.GITHUB_SHA || 'local', screenshots: [], errors: [], fallbackImages: [] };
const cache = new Map();

// Stable, non-private fixtures if the demo image CDN is unavailable.
function fallback(url) {
  const n = parseInt(createHash('sha256').update(url.split('?')[0]).digest('hex').slice(0, 6), 16);
  const hue = n % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><linearGradient id="s" x2=".2" y2="1"><stop stop-color="hsl(${hue},35%,27%)"/><stop offset="1" stop-color="hsl(${(hue+36)%360},44%,65%)"/></linearGradient></defs><rect width="1200" height="800" fill="url(#s)"/><circle cx="${250+n%600}" cy="220" r="90" fill="#f7dfaa" opacity=".85"/><path d="M0 540L260 290 500 530 760 330 1200 550V800H0Z" fill="hsl(${(hue+110)%360},23%,32%)"/><path d="M0 670Q350 450 700 650T1200 530V800H0Z" fill="hsl(${(hue+100)%360},24%,18%)"/></svg>`;
}
async function imageRoute(route) {
  const url = route.request().url();
  if (!cache.has(url)) cache.set(url, (async () => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(String(response.status));
      return { body: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') || 'image/jpeg' };
    } catch {
      report.fallbackImages.push(url);
      return { body: Buffer.from(fallback(url)), contentType: 'image/svg+xml' };
    }
  })());
  const asset = await cache.get(url);
  await route.fulfill({ status: 200, ...asset });
}
async function capture(page, name) {
  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]);
    await Promise.race([Promise.all([...document.images].filter(i => i.loading !== 'lazy' || i.getBoundingClientRect().top < innerHeight).map(i => i.decode().catch(() => {}))), new Promise(r => setTimeout(r, 2000))]);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(output, name + '.png'), animations: 'disabled', scale: 'css' });
  const layout = await page.evaluate(() => {
    const rect = s => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom), scrollHeight: e.scrollHeight, clientHeight: e.clientHeight };
    };
    return { viewport: [innerWidth, innerHeight], document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], canvas: rect('.image-stage'), controls: rect('.controls-panel'), gallery: rect('.gallery-panel'), toolbar: rect('.ark-canvas-toolbar'), generate: rect('.generate-button'), failedVisibleImages: [...document.images].filter(i => i.getBoundingClientRect().top < innerHeight && i.complete && !i.naturalWidth).length };
  });
  report.screenshots.push({ name, layout });
  if (layout.generate && layout.controls &&
      (layout.generate.bottom > layout.controls.bottom + 1 ||
       layout.generate.y < layout.controls.y ||
       layout.generate.bottom > layout.viewport[1] + 1)) {
    throw new Error('Generate action outside visible controls at ' + name);
  }
  if (layout.document[0] > layout.viewport[0] + 1 || layout.document[1] > layout.viewport[1] + 1) {
    throw new Error('Workspace overflows the browser viewport at ' + name);
  }
}
async function scenario(size) {
  const [width, height] = size;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    localStorage.setItem('ark-surface-theme', 'nocturne');
    localStorage.setItem('ark-mini-library-visible', 'true');
    localStorage.setItem('ark-mini-library-side', 'right');
    localStorage.setItem('ark-mini-columns', '2');
  });
  await context.route('https://images.unsplash.com/**', imageRoute);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.errors.push({ viewport: size, message: error.message }));
  const prefix = width + 'x' + height;
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('.stage-image').waitFor({ state: 'visible' });
    await capture(page, prefix + '-library-open');
    if (width === 1440) {
      await page.getByRole('button', { name: 'Edit workspace layout' }).click();
      await capture(page, prefix + '-layout-edit');
      const dragPanel = async (source, target) => {
        const handle = page.getByRole('button', { name: 'Move ' + source, exact: true });
        const from = await handle.boundingBox();
        const to = await page.locator('[data-panel="' + target + '"]').boundingBox();
        if (!from || !to) throw new Error('Missing drag source or target');
        await page.mouse.move(from.x+from.width/2,from.y+from.height/2);
        await page.mouse.down();
        await page.mouse.move(to.x+to.width/2,to.y+Math.min(80,to.height/2),{steps:12});
        if (!(await page.locator('.ark-grid-drop-preview.is-primary').count())) throw new Error('No occupied drop preview');
        await page.mouse.up();
      };
      const geometry = async id => page.locator('[data-panel="' + id + '"]').evaluate(el => ['x','y','w','h'].map(k => Number(el.getAttribute('gs-'+k) || (k==='w'||k==='h'?1:0))));
      const canvasBefore = await geometry('canvas');
      const controlsBefore = await geometry('controls');
      await dragPanel('Studio controls','canvas');
      const controlsLeft = await geometry('controls');
      const canvasAfter = await geometry('canvas');
      if (controlsLeft[0] !== 0 || controlsLeft[2] !== controlsBefore[2] || canvasAfter[0] !== controlsBefore[2] || canvasAfter[2] !== canvasBefore[2]) throw new Error('Packed unequal-width panel reorder failed');
      await capture(page,prefix+'-controls-left');
      await dragPanel('Library','controls');
      if ((await geometry('library'))[0] !== 0) throw new Error('Packed Library reorder failed');
      await capture(page,prefix+'-library-left');
      await page.getByRole('button', { name: 'Reset workspace layout' }).click();
      const handle = page.getByRole('button', { name: 'Move Library', exact: true });
      await handle.focus();
      const tile = page.locator('[data-panel="library"]');
      const initialHeight = Number(await tile.getAttribute('gs-h') || 0);
      for (let i = 0; i < 5; i++) await handle.press('Shift+ArrowUp');
      if (Number(await tile.getAttribute('gs-h') || 0) >= initialHeight) throw new Error('Library keyboard resize failed');
      const beforeDrag = Number(await tile.getAttribute('gs-y') || 0);
      const bounds = await handle.boundingBox();
      const cellHeight = await page.locator('.ark-workspace-grid').evaluate(el => el.getBoundingClientRect().height / 24);
      if (!bounds) throw new Error('Library drag handle is not visible');
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + cellHeight * 3, { steps: 12 });
      await page.mouse.up();
      const afterDrag = Number(await tile.getAttribute('gs-y') || 0);
      if (afterDrag === beforeDrag) throw new Error('Library did not move during layout drag');
      await capture(page, prefix + '-layout-custom');
      await page.getByRole('button', { name: 'Lock workspace layout' }).click();
      if (await page.locator('.ark-grid-handle:visible').count()) throw new Error('Layout handles visible after locking');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.stage-image').waitFor({ state: 'visible' });
      if (Number(await tile.getAttribute('gs-y') || 0) !== afterDrag) throw new Error('Saved workspace was not restored');
      await capture(page, prefix + '-layout-persisted');
      await page.getByRole('button', { name: 'Edit workspace layout' }).click();
      await page.getByRole('button', { name: 'Reset workspace layout' }).click();
      if (Number(await tile.getAttribute('gs-y') || 0) !== 0 || Number(await tile.getAttribute('gs-h') || 0) !== initialHeight) throw new Error('Reset did not restore the default geometry');
      const prompt = page.getByRole('textbox', { name: 'Generation prompt' });
      const originalPrompt = await prompt.inputValue();
      await prompt.fill('GridStack state preservation test');
      await page.getByRole('button', { name: 'Lock workspace layout' }).click();
      if (await prompt.inputValue() !== 'GridStack state preservation test') throw new Error('Prompt lost when locking workspace');
      await prompt.fill(originalPrompt);
    }
    await page.locator('header button[aria-label="Collapse Mini Library"]').click();
    await capture(page, prefix + '-library-closed');
    if (width === 1440) {
      await page.getByRole('button', { name: 'Edit workspace layout' }).click();
      const handle = page.getByRole('button', { name: 'Move Studio controls', exact: true });
      await handle.focus();
      await handle.press('ArrowLeft');
      if (Number(await page.locator('[data-panel="controls"]').getAttribute('gs-x') || 0) !== 0) throw new Error('Packed two-panel keyboard reorder failed');
      await capture(page,prefix+'-two-panel-controls-left');
      await page.getByRole('button', { name: 'Reset workspace layout' }).click();
      await page.getByRole('button', { name: 'Lock workspace layout' }).click();
    }
    if (width === 1440) {
      for (const [name, label] of [['compare', 'Compare images'], ['mask', 'Paint mask'], ['pan', 'Pan image']]) {
        await page.getByRole('button', { name: label, exact: true }).click();
        await capture(page, prefix + '-' + name);
      }
      await page.locator('button[title="Show iterations"]').click();
      await capture(page, prefix + '-iterations');
      await page.locator('button[title="Collapse iterations"]').click();
      await page.getByRole('button', { name: 'Open generation setup' }).click();
      await capture(page, prefix + '-generation-settings');
      await page.getByRole('button', { name: 'Close generation setup' }).click();
      await page.locator('.reference-card .ref-import').first().click();
      await capture(page, prefix + '-reference-picker');
    }
  } catch (error) {
    report.errors.push({ viewport: size, message: error.message });
    console.error(prefix, error.message);
    await page.screenshot({ path: join(output, prefix + '-failure.png') }).catch(() => {});
  } finally {
    await context.close();
  }
}
try {
  for (let i=0; i<40; i++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    if (i===39) throw new Error('Preview server did not start');
    await new Promise(r => setTimeout(r, 500));
  }
  browser = await chromium.launch({ headless: true });
  for (const size of [[1920,1080], [1440,900], [1280,720]]) await scenario(size);
} finally {
  await browser?.close();
  server.kill();
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
}
if (report.errors.length) process.exitCode = 1;
