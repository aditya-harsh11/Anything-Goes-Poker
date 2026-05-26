// Quick mobile-view check: drive host + guest at 390x844 (iPhone 13/14 size)
// and capture the full-page screenshot so we can see the whole stack.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('/tmp/poker-shots', { recursive: true });
const MOBILE = { width: 390, height: 844 };

async function fullShot(page, name) {
  await page.screenshot({ path: `/tmp/poker-shots/${name}.png`, fullPage: true });
  console.log('saved', name);
}

(async () => {
  const browser = await chromium.launch();
  const hostCtx = await browser.newContext({ viewport: MOBILE });
  const host = await hostCtx.newPage();
  await host.goto('http://localhost:5173/');
  await host.locator('input').first().fill('Alice');
  await host.getByRole('button', { name: /deal me in/i }).click();
  await host.waitForURL(/\/game\//);
  await host.waitForTimeout(400);
  const roomUrl = host.url();

  const guestCtx = await browser.newContext({ viewport: MOBILE });
  const guest = await guestCtx.newPage();
  await guest.goto(roomUrl);
  await guest.waitForTimeout(300);
  await guest.getByPlaceholder(/your name/i).fill('Bob');
  await guest.getByRole('button', { name: /request to join|join/i }).click();
  await guest.waitForTimeout(400);

  await host.waitForTimeout(400);
  await host.getByRole('button', { name: /approve/i }).first().click();
  await host.waitForTimeout(500);

  await fullShot(host, 'mobile-01-host-pre-deal');
  await fullShot(guest, 'mobile-02-guest-pre-deal');

  await host.getByRole('button', { name: /start game|deal.*hand/i }).first().click();
  await host.waitForTimeout(700);
  // host is dealer hand 1
  if (await host.locator('text=Choose the game').first().isVisible().catch(() => false)) {
    await host.locator('button', { hasText: /texas.*hold/i }).first().click();
    await host.waitForTimeout(600);
  }

  await fullShot(host, 'mobile-03-host-mid-hand');
  await fullShot(guest, 'mobile-04-guest-mid-hand');

  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
