// Stress test: 6-player table to verify the bottom-side seats no longer crash
// into the bottom-center pod after the seat-position changes.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve('/tmp/poker-shots');
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

  // 5 more guests
  const guests = [];
  for (let i = 1; i <= 5; i++) {
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
  for (let i = 0; i < 5; i++) {
    const btn = host.getByRole('button', { name: /approve/i }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await host.waitForTimeout(300);
    }
  }
  await host.waitForTimeout(600);
  await shot(host, '20-six-players-seated-wide');

  // Start hand
  await host.getByRole('button', { name: /start game|deal.*hand/i }).first().click();
  await host.waitForTimeout(800);

  // Dealer (whoever) picks Texas
  for (const p of [host, ...guests]) {
    if (await p.locator('text=Choose the game').first().isVisible().catch(() => false)) {
      await p.locator('button', { hasText: /texas.*hold/i }).first().click();
      await p.waitForTimeout(500);
      break;
    }
  }
  await host.waitForTimeout(800);
  await shot(host, '21-six-players-mid-hand-wide-host');
  await shot(guests[0], '22-six-players-mid-hand-wide-P1');
  await shot(guests[2], '23-six-players-mid-hand-wide-P3');

  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
