# Play Poker

A self-hosted real-time multiplayer poker room for home games. One host
opens a game, shares a link, and up to eight friends pile in. Between every
hand, whoever has the dealer button picks the variant — Texas, Omaha,
Pineapple, Bomb Pots, even Blackjack Hold'em — and the server deals it.

The point was to build a *real* engine rather than a card-flipping UI. The
server is authoritative: it handles dealing, blinds, betting rounds, all-ins,
side pots, hand evaluation, and pot awarding, and the client only renders
state it's told about. Reconnect mid-hand from a refresh and your seat is
still yours. Play money only — settle up offline.

**Live:** https://anything-goes-poker.onrender.com

## Stack

- **client/** — React + Vite + TypeScript + Tailwind
- **server/** — Node.js + Express + Socket.IO + TypeScript (game engine lives here)
- **shared/** — TypeScript types shared by both (`@poker/shared`)

## Run

```bash
npm install          # installs all workspaces
npm run dev          # server (:3001) + client (:5173)
```

Open http://localhost:5173. The dev server also listens on the LAN, so
friends on the same network can join at `http://<your-lan-ip>:5173/game/<roomId>`.

## Test

```bash
npm test             # vitest unit tests on the engine
```

End-to-end socket scripts (against a server on `:3001`, or set `SMOKE_URL`):
`scripts/smoke.mjs`, `scripts/reconnect.mjs`, `scripts/variant.mjs`
(`VARIANT=...`), `scripts/pineapple.mjs`, `scripts/bomb.mjs`.

UI smoke (Playwright, needs `npx playwright install chromium`):
`scripts/verify-ui.mjs` (host + guest happy path), `scripts/verify-ui-6players.mjs`
(6-seat layout stress test).

## Variants

| Variant | Hole cards | Rule |
|---|---|---|
| Texas Hold'em | 2 | Best five of seven (auto) |
| Pot-Limit Omaha | 4 | Use exactly 2; pot-limit betting |
| Dirty Omaha | 4 | Use any number (even the whole board) |
| 2-or-3 | 5 | Use exactly 2 or 3 |
| All 5 | 5 | Use any number |
| 1-3-5 | 5 | Use exactly 1, 3, or 5 |
| Pineapple | 3 | Discard 1 after the flop, then Hold'em |
| Crazy Pineapple | 5 | Discard 1 after flop, turn, river — down to 2 at showdown |
| Bomb Pot (Hold'em / Omaha) | 2 / 4 | Ante, no preflop, two boards, pot split per board |
| Blackjack Hold'em | 4 | 2 for poker + 2 for blackjack; pot split 50/50 |
| Number | 5 | Pick 3 (in order) to build a number vs. the dealer's target + 2 for poker; pot split 50/50 |

**You pick your own cards.** In every variant where there's a choice
(Omaha, 2-or-3, etc.) the engine does *not* auto-pick your best combination
— you choose which hole cards to use at showdown, and you get a private
note if a stronger hand was available.

## Features

- Create/join via link, host approval, token-based reconnection
- **Dealer's choice** between hands — host clicks "Start hand," the
  dealer-on-the-button picks the variant, and the engine deals it atomically
- Host controls: approve/decline players, add buy-ins, set stacks, kick,
  sit out/in
- Live ledger (buy-in / stack / net per player), dealer + SB/BB tokens,
  two-board display for bomb pots
- Winner glow at showdown, hand-rank shown in the banner
  ("Bob wins 360, Two Pair")
- Opt-in "show cards" at showdown (no auto-reveal)
- Partition-style pickers for Bomb Omaha (A/B) and Blackjack Hold'em (P/B):
  pick N, the rest auto-fill
