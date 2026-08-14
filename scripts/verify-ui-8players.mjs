// Stress test: 8-player table to check whether the right-side action/host rail
// covers any seats on a standard desktop viewport.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve('scripts/.shots');
mkdirSync(OUT, { recursive: true });
const WIDE = { width: 1440, height: 900 };

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log('  saved', name);
}

(async () => {
  const browser = await chromium.launch();
  // Host
  const hostCtx = await browser.newContext({ viewport: WIDE });
  const host = await hostCtx.newPage();
  host.on('pageerror', (e) => console.error('[host pageerror]', e.message));
  await host.goto('http://localhost:5173/');
  await host.locator('input').first().fill('P0_Host');
  await host.getByRole('button', { name: /deal me in/i }).click();
  await host.waitForURL(/\/game\//);
  await host.waitForTimeout(400);
  const roomUrl = host.url();

  // 7 more guests, each in its own isolated context (own localStorage).
  const guests = [];
  for (let i = 1; i <= 7; i++) {
    const ctx = await browser.newContext({ viewport: WIDE });
    const page = await ctx.newPage();
    await page.goto(roomUrl);
    await page.waitForTimeout(300);
    await page.getByPlaceholder(/your name/i).fill(`P${i}`);
    await page.getByRole('button', { name: /request to join|join/i }).first().click();
    await page.waitForTimeout(400);
    guests.push(page);
  }

  // Host approves all
  await host.waitForTimeout(500);
  for (let i = 0; i < 7; i++) {
    const btn = host.getByRole('button', { name: /approve/i }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await host.waitForTimeout(300);
    }
  }
  await host.waitForTimeout(800);
  await shot(host, '30-eight-players-seated-host');

  // Assert every seat pod is fully inside the table's clip area (regression check
  // for the leftmost/rightmost seats bleeding past the play area — the right one
  // reads as "covered by the sidebar" since the clip edge sits right where the
  // host/action rail begins).
  const bounds = await host.evaluate(() => {
    const wrap = document.querySelector('main .relative.w-full.overflow-hidden');
    const w = wrap.getBoundingClientRect();
    const seats = [...document.querySelectorAll('main .relative.w-full.overflow-hidden .absolute.z-10')];
    return seats.map((s) => {
      const r = s.getBoundingClientRect();
      return {
        name: s.textContent?.slice(0, 10),
        insideX: r.left >= w.left - 0.5 && r.right <= w.right + 0.5,
        insideY: r.top >= w.top - 0.5 && r.bottom <= w.bottom + 0.5,
      };
    });
  });
  const clipped = bounds.filter((b) => !b.insideX || !b.insideY);
  if (clipped.length > 0) {
    throw new Error(`seat pods clipped by the table's clip boundary: ${JSON.stringify(clipped)}`);
  }
  console.log('  all 8 seat pods fully inside the table area');

  // Start hand
  await host.getByRole('button', { name: /start game|deal.*hand/i }).first().click();
  await host.waitForTimeout(800);

  // Dealer (whoever) picks Texas
  for (const p of [host, ...guests]) {
    if (await p.locator('text=Choose the game').first().isVisible().catch(() => false)) {
      await p.locator('.panel button', { hasText: /texas hold/i }).first().click();
      await p.waitForTimeout(500);
      break;
    }
  }
  await host.waitForTimeout(800);
  await shot(host, '31-eight-players-mid-hand-host');
  await shot(guests[0], '32-eight-players-mid-hand-P1');
  await shot(guests[5], '33-eight-players-mid-hand-P6');

  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
