// Drive the poker UI through every major state with two real browser contexts
// (host + guest) and capture screenshots at 1440x900 and 480x900.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve('/tmp/poker-shots');
mkdirSync(OUT, { recursive: true });

const WIDE = { width: 1440, height: 900 };
const NARROW = { width: 480, height: 900 };

async function shot(page, name) {
  const p = `${OUT}/${name}.png`;
  await page.screenshot({ path: p, fullPage: false });
  console.log('  saved', p);
}

async function fillField(page, placeholderRe, value) {
  const el = page.getByPlaceholder(placeholderRe);
  await el.first().fill(value);
}

(async () => {
  const browser = await chromium.launch();

  // === host ===
  const hostCtx = await browser.newContext({ viewport: WIDE });
  const host = await hostCtx.newPage();
  host.on('pageerror', (e) => console.error('[host pageerror]', e.message));
  host.on('console', (m) => { if (m.type() === 'error') console.error('[host console]', m.text()); });
  await host.goto('http://localhost:5173/');
  await host.waitForLoadState('networkidle');
  await shot(host, '01-home-wide');

  // Fill home and create
  // (the home form uses name + buy-in inputs; click "Start a table")
  await host.waitForTimeout(400);
  const nameInput = host.locator('input').first();
  await nameInput.fill('Alice');
  const startBtn = host.getByRole('button', { name: /deal me in/i });
  await startBtn.first().click();
  await host.waitForURL(/\/game\//, { timeout: 10000 });
  await host.waitForLoadState('networkidle');
  await host.waitForTimeout(500);
  const roomUrl = host.url();
  console.log('room url:', roomUrl);
  const roomId = roomUrl.split('/game/')[1];
  await shot(host, '02-room-host-only-wide');

  // === guest joins ===
  const guestCtx = await browser.newContext({ viewport: WIDE });
  const guest = await guestCtx.newPage();
  guest.on('pageerror', (e) => console.error('[guest pageerror]', e.message));
  guest.on('console', (m) => { if (m.type() === 'error') console.error('[guest console]', m.text()); });
  await guest.goto(roomUrl);
  await guest.waitForLoadState('networkidle');
  await guest.waitForTimeout(400);
  await shot(guest, '03-guest-take-seat-wide');

  await guest.getByPlaceholder(/your name/i).fill('Bob');
  await guest.getByRole('button', { name: /request to join|join/i }).first().click();
  await guest.waitForTimeout(500);
  await shot(guest, '04-guest-pending-wide');

  // Host approves
  await host.waitForTimeout(400);
  await shot(host, '05-host-with-pending-wide');
  await host.getByRole('button', { name: /approve/i }).first().click();
  await host.waitForTimeout(800);
  await shot(host, '06-host-after-approve-wide');
  await shot(guest, '07-guest-seated-wide');

  // Start hand — host clicks "Start game" / "Deal next hand"
  const startGame = host.getByRole('button', { name: /start game|deal.*hand/i }).first();
  await startGame.click();
  await host.waitForTimeout(800);
  await shot(host, '08-host-awaiting-dealer-pick-wide');
  await shot(guest, '09-guest-awaiting-dealer-pick-wide');

  // The dealer (whoever has it) sees the auto-open VariantPicker. Check both.
  // Click the first variant in whichever picker is open.
  for (const [name, page] of [['host', host], ['guest', guest]]) {
    const pickerVisible = await page.locator('text=Choose the game').first().isVisible().catch(() => false);
    if (pickerVisible) {
      await shot(page, `10-${name}-variant-picker-wide`);
      // pick texas
      const texasBtn = page.locator('button', { hasText: /texas.*hold/i }).first();
      await texasBtn.click();
      await page.waitForTimeout(600);
      console.log(`  ${name} picked Texas`);
      break;
    }
  }
  await host.waitForTimeout(800);
  await shot(host, '11-host-mid-hand-wide');
  await shot(guest, '12-guest-mid-hand-wide');

  // Mid-hand betting controls. Whoever's turn it is sees Fold/Call/Raise.
  // Try both pages.
  for (const [name, page] of [['host', host], ['guest', guest]]) {
    const foldBtn = page.getByRole('button', { name: /^fold$/i });
    if (await foldBtn.isVisible().catch(() => false)) {
      await shot(page, `13-${name}-betting-controls-wide`);
      // Click pot button if available, then raise to see slider
      const potBtn = page.getByRole('button', { name: /^pot$/i });
      if (await potBtn.isVisible().catch(() => false)) {
        await potBtn.click();
        await page.waitForTimeout(200);
        await shot(page, `14-${name}-after-pot-click-wide`);
      }
      break;
    }
  }

  // Narrow viewport
  await host.setViewportSize(NARROW);
  await host.waitForTimeout(400);
  await shot(host, '15-host-narrow');
  await guest.setViewportSize(NARROW);
  await guest.waitForTimeout(400);
  await shot(guest, '16-guest-narrow');

  // Push to showdown: have both fold/call until done. Reset to wide.
  await host.setViewportSize(WIDE);
  await guest.setViewportSize(WIDE);
  await host.waitForTimeout(400);

  // Walk the hand: whoever's turn it is checks/calls. Loop for ~16 actions.
  for (let i = 0; i < 24; i++) {
    let acted = false;
    for (const page of [host, guest]) {
      const check = page.getByRole('button', { name: /^check$/i });
      const call = page.getByRole('button', { name: /^call\s/i });
      if (await check.isVisible().catch(() => false)) {
        await check.click();
        acted = true;
        await page.waitForTimeout(400);
        break;
      }
      if (await call.isVisible().catch(() => false)) {
        await call.click();
        acted = true;
        await page.waitForTimeout(400);
        break;
      }
    }
    if (!acted) break;
  }
  await host.waitForTimeout(800);
  await shot(host, '17-host-showdown-wide');
  await shot(guest, '18-guest-showdown-wide');

  // Open the Ledger modal
  const ledgerBtn = host.getByRole('button', { name: /ledger/i }).first();
  if (await ledgerBtn.isVisible().catch(() => false)) {
    await ledgerBtn.click();
    await host.waitForTimeout(400);
    await shot(host, '19-host-ledger-wide');
    await host.keyboard.press('Escape');
    await host.locator('text=Ledger').first().click({ button: 'left' }).catch(() => {});
    await host.waitForTimeout(200);
    // close via close button if escape didn't dismiss
    const closeBtn = host.getByRole('button', { name: /^close$/i });
    if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
  }

  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
