# Anything Goes Poker

A self-hosted, real-time multiplayer poker room for home games — every common variant on one
table, dealer's choice each hand. A host creates a game, shares a link, and up to 8 players join
as guests (host approves). Between hands, whoever has the dealer button picks the variant for the
next hand. The app tracks **play-money chips only** — no real cash moves through it (settle up
offline). The server runs the full game: dealing, blinds, betting rounds, all-ins, side pots, hand
evaluation, and pot awarding.

## Stack
- **client/** — React + Vite + TypeScript (Tailwind CSS)
- **server/** — Node.js + Express + Socket.IO + TypeScript (authoritative game engine)
- **shared/** — TypeScript types shared by client and server (`@poker/shared`)

## Develop
```bash
npm install          # installs all workspaces
npm run dev          # starts server (:3001) + client (:5173) together
```
Open http://localhost:5173 to create a game. The client also listens on the LAN, so friends on the
same network can open `http://<your-lan-ip>:5173/game/<roomId>`.

## Test
```bash
npm test             # server engine unit tests (vitest)
```
End-to-end socket scripts (run against a server on `:3001`, or set `SMOKE_URL`):
`scripts/smoke.mjs` (a full Texas hand), `scripts/reconnect.mjs`, `scripts/variant.mjs`
(`VARIANT=...` manual-select variants), `scripts/pineapple.mjs`, `scripts/bomb.mjs`.

UI smoke (Playwright, requires `npx playwright install chromium`):
`scripts/verify-ui.mjs` (full host+guest happy path), `scripts/verify-ui-6players.mjs` (6-seat
layout stress test).

## Variants
Picked by the host when creating a game:

| Variant | Hole cards | Rule |
|---|---|---|
| Texas Hold'em | 2 | Best five of seven (auto) |
| Pot-Limit Omaha | 4 | Use exactly 2; pot-limit betting |
| Dirty Omaha | 4 | Use any number (even the board) |
| 2-or-3 | 5 | Use exactly 2 or 3 |
| All 5 | 5 | Use any number |
| 1-3-5 | 5 | Use exactly 1, 3, or 5 |
| Pineapple | 3 | Discard 1 after the flop, then Hold'em |
| Crazy Pineapple | 5 | Discard 1 after the flop, turn and river — down to 2 at showdown |
| Bomb Pot (Hold'em / Omaha) | 2 / 4 | Ante, no preflop, two boards, pot split per board |
| Blackjack Hold'em | 4 | Pick 2 for poker + 2 for blackjack; pot split 50/50 |

**You pick your own cards.** In every variant where there's a choice (Omaha, 2-or-3, etc.), the
engine does **not** auto-pick your best combination — you choose which hole cards to use at
showdown, and you get a private note if a stronger hand was available.

## Features
- Create/join via link, host approval, token-based reconnection
- **Dealer's choice** between hands: host clicks "Start hand" → the dealer-on-the-button picks the
  variant, which atomically deals it
- Host & money controls: approve/decline, add buy-in, set stack, kick, sit out/in
- Ledger (buy-in / stack / net per player), dealer + SB/BB tokens, two-board display for bomb pots
- Winner glow on the winning seat at showdown, hand-rank shown in the banner ("Bob wins 360, Two Pair")
- Opt-in "show cards" at showdown (no auto-reveal)
- Partition-style pickers for Bomb Omaha (A/B) and Blackjack Hold'em (P/B): pick N, the rest auto-fill
