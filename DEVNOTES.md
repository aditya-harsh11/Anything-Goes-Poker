# Anything Goes Poker — Dev Notes

Working reference for the codebase: how it's put together, the non-obvious bits, and how to
run/extend it. (User-facing intro is in `README.md`; deploying is in `DEPLOY.md`.)

## What it is
A real-time, **play-chip** multiplayer poker room with every common variant on one table —
between hands, the dealer-on-the-button picks what gets dealt next. A host creates a game, shares a
link, and up to 8 guests join (host approves). The **server runs the whole game** — dealing,
blinds/antes, betting, all-ins, side pots, hand evaluation, pot awarding — across many independent
tables at once.

## Stack & layout (npm workspaces monorepo)
```
shared/   @poker/shared — TS types shared by client & server (cards, events, state, variants)
server/   Node + Express + Socket.IO + the authoritative game engine (run with tsx)
client/   React + Vite + Tailwind v4
scripts/  *.mjs end-to-end socket tests (run against a live server)
```
- **Shared types are the contract.** Client and server both import `@poker/shared`; the Socket.IO
  events are typed there (`ClientToServerEvents` / `ServerToClientEvents`).
- `tsx` runs the server directly from TS (no build step); it's a runtime dependency so production
  installs keep it.

## Run / build / test
```bash
npm install
npm run dev        # server :3001 + client :5173 (concurrently)
npm test           # server engine unit tests (vitest)
npm run build      # builds the client into client/dist
npm start          # runs the server; in prod it also serves client/dist (single-host)
```
**End-to-end socket scripts** (start a server first, point with `SMOKE_URL`):
```bash
PORT=3010 npx tsx watch server/src/index.ts          # a server to test against
SMOKE_URL=http://localhost:3010 node scripts/smoke.mjs            # full Texas hand
VARIANT=dirty-omaha SMOKE_URL=... node scripts/variant.mjs        # manual-select variants
VARIANT=crazy-pineapple SMOKE_URL=... node scripts/pineapple.mjs  # discard variants
VARIANT=bomb-omaha SMOKE_URL=... node scripts/bomb.mjs            # bomb pots
node scripts/{reconnect,allinshow,note,handname,multivariant}.mjs
```
They assert invariants (chips conserved, correct phases) rather than exact winners (deck is random).

## Architecture
**Server-authoritative.** The full deck and every hole card live only on the server. Each client
gets a **redacted, per-recipient snapshot** (`Room.snapshotFor(viewerId)`) — you only see your own
cards (others' only when revealed). Clients send *intents*; the server validates everything. Deck is
shuffled with `crypto.randomInt` (Fisher–Yates).

**Rooms.** `RoomManager` holds a `Map<roomId, Room>`. Each `Room` is fully independent (its own
players, chips, and current `PokerGame`). Many tables run on one process; an event in one room only
re-broadcasts to that room. Room state is **in memory** (no DB).

**Flow:** client emits → `net/socketHandlers.ts` validates (zod for actions) and calls a `Room`
method → `Room` mutates state / delegates to `PokerGame` → `broadcast(io, room)` sends each socket
its own snapshot.

### Key server files
- `engine/deck.ts` — secure shuffle + deal.
- `engine/handEvaluator.ts` — wraps `pokersolver`. `solve`, `compareHands`, `winnersAmong`,
  `bestHandUsing` (forces given hole cards), `handFromSelection`, `bestSelection` (best over allowed
  counts — powers the advisor). `describe()` strips the suit off kicker names ("Flush, Kd High" →
  "Flush, K High").
- `engine/blackjack.ts` — blackjack scoring (ace 1/11, naturals AK>AQ>AJ>A10, closest-to-21).
- `engine/sidePots.ts` — layered side-pot construction from per-player contributions.
- `engine/pokerGame.ts` — **the heart.** One hand's lifecycle + betting state machine.
- `rooms/room.ts` — lobby, seats, chip ledger, host controls, snapshot/redaction.
- `rooms/roomManager.ts`, `net/socketHandlers.ts`, `index.ts`.

### Betting state machine (pokerGame.ts)
Per street it tracks `currentBet`, `minRaise`, `lastFullRaiseBet`, `actedThisStreet`,
`lastActedBet`, and `lastAggressorId` (last to bet/raise this street — drives showdown reveal
order; reset each street). A player is "settled" if folded/all-in or (matched `currentBet` AND
acted). Round ends when all are settled. Handles: blinds (heads-up button=SB), legal-action calc
(`availableActionsFor`), short all-ins **not** reopening betting, uncalled-bet return, side pots, and
all-in run-outs (deal remaining streets when ≤1 player can act).

**While the hand is paused for discards or card selection** (`awaitingDiscard` /
`awaitingSelection`), there is **no current actor**: `currentActorId`, `availableActionsFor`, and
`applyAction` all short-circuit. (Skipping this guard was the old "phantom actor" bug where a stale
Check/Fold bar appeared over the discard prompt and corrupted the round.)

### Showdown paths
- **Auto** (Texas / Pineapple / Crazy Pineapple — 2 cards by showdown): `resolveAutoShowdown` →
  `awardFromSolved`, best 5 of 7.
- **Manual select** (PLO, Dirty Omaha, 2-or-3, All 5, 1-3-5): pauses (`awaitingSelection`); each
  contender picks which hole cards to use (`submitSelection`), then `resolveSelectedShowdown`.
  - **Advisor notes** (private, in `notes` map → `RoomState.youNote`): losers who left a better hand
    get "you could have made X" (skipped if only kicker-different); players whose pick was already
    optimal get "Nicely played…"; winners get neither.
- **Bomb pots**: ante (fixed `BOMB_ANTE = 50`), no preflop, two boards (`board` + `board2`), each pot
  split 50/50 per board (`resolveBombShowdown`).
  - **Bomb Omaha** must use exactly 2 of 4 per board, so it **pauses for a two-board selection**
    (`bombNeedsSelection()` → `awaitingSelection`): each contender submits picks for both boards via
    `submitBombSelection(a, b)` (`selectBombCards` event); Board A → `selections`, Board B →
    `selectionsB`. Bomb Hold'em has nothing to choose, so it auto-resolves. Force/auto fills the
    best per board.
- **Blackjack Hold'em**: assign 2 cards to poker + 2 to blackjack; pot split 50/50
  (`resolveBlackjackShowdown`).
- **Fold-win**: `endHandByFold` (no reveal).
- **Reveal order at showdown** (`applyShowdownReveals`, used by `awardFromSolved`): standard card-room
  order — the **last aggressor** on the final street shows first (or the **first live player left of
  the button** if the street was checked down), then clockwise (`revealOrder`). Each later contender
  only turns up if they **match/beat** the best hand shown so far; otherwise they **muck** (stay
  hidden). **All-in players always show.** Split-pot variants (bomb / blackjack) reveal **all**
  contenders (`revealAllContenders`) since "beats best" is ambiguous across two boards.
- **Showing after the hand:** everyone dealt in (incl. **folders and losers**) keeps their hole cards
  through the showdown window so they can optionally `showCards` (flash a bluff). Cards are wiped for
  all at the next `startHand`.

### Discards (Pineapple family)
`VariantConfig.discardSchedule = [afterFlop, afterTurn, afterRiver]`. After dealing each street the
engine pauses (`awaitingDiscard`, target = holeCards − cumulative schedule) until every contender
discards down to target, then opens betting. Pineapple = `[1]` (3→2); Crazy Pineapple = `[1,1,1]`
(5→2). Host "Force discard" / `forceResolve` auto-discards if someone stalls.

## Variant system
All variants are data in `shared/src/variants.ts` (`VARIANTS` record + `VARIANT_LIST`, ordered Texas,
PLO, then alphabetical). A `VariantConfig`: `holeCards`, `allowedHoleCounts`, `manualSelect`,
`discardSchedule`, `bombPot`, `blackjack`, `bettingStructure`.

**To add a variant:** add an entry to `VARIANTS` (and the `Variant` union). The engine reads the
config — most variants need no engine changes. Only genuinely new mechanics (a new pot structure,
new eval) need code in `pokerGame.ts`. The picker modal (`VariantPicker`) is generated from
`VARIANT_LIST`.

**Dealer's choice (per-hand variant):** the **upcoming dealer picks the game; the host deals.**
`Room.nextDealerId()` computes who's on the button next (mirrors `startHand`'s button logic) and the
snapshot exposes `nextDealerId` + `youAreDealer` (only between hands). The dealer opens
`VariantPicker` ("Change game" → `hostSetVariant` → `Room.setVariant`, rejected mid-hand; server
authorizes via `canPickGame` = dealer **or** host fallback before any dealer exists). `startHand` is
**host-only** (`requireHost`) and uses the current `settings.variant`. The client `TableControls`
shows these between hands: dealer sees "Your deal — pick the game" + Change game; host sees Deal.

## Client notes
- `lib/socket.ts` — single Socket.IO singleton. Connects to `VITE_SERVER_URL` if set, else `:3001`
  in dev, else same-origin in prod. Reconnects forever with backoff. Exports `serverBase` for plain
  HTTP (the keep-alive).
- `lib/useRoom.ts` — subscribes to `roomState` / `yourCards`; tracks `connected`; on
  every (re)connect `GameRoom` re-sends `rejoin` with the localStorage session token, so a
  refresh/drop reclaims your seat (token-based reconnection). Also runs a **keep-alive** (prod only):
  `fetch('/health')` every 4 min while a table is open, so free hosts that gauge idleness by HTTP
  traffic don't spin the WebSocket-only server down mid-game (see Deployment).
- **Reconnection UX (`GameRoom`):** while `!connected` a blocking **"Reconnecting…"** overlay covers
  the table (no clicking dead buttons). If `rejoin` comes back **"Room not found"** (server
  restarted/slept → tables wiped) it shows a **"Table unavailable"** screen (Home / Try again) instead
  of a stale, dead UI. "Session not found" (room alive, you were removed) → the join screen.
- `components/Table.tsx` — oval table; seats positioned by angle, rotated so **you** sit at the
  bottom. Rendered at a fixed design size (`DESIGN_W=1150`) and **scaled to fill the container width**
  via a ResizeObserver (cap `MAX_SCALE=1.25`; no blank side gutters), shrinking on phones. Seat radius
  is tightened so side pods don't clip. Only face-up cards render (no backs); your own cards dock in
  your pod. A small **recycle icon + count** by a name shows that player's `rebuys`.
- `components/PlayingCard.tsx` — `xs/sm/md/lg` sizes (bumped larger this round; `lg` = board).
- `components/VariantPicker.tsx` — modal listing **every** variant + rules (dealer's "Change game");
  closes on Close / backdrop / Esc.
- `pages/GameRoom.tsx` panels: `TableStatus` (dealer picks / host deals, between hands),
  `ChooseTray` (discard / single-board select) + `BombSelectTray` (two-board Omaha select),
  `ShowHandControls` ("Show your hand" — works even if you folded/lost), `ActionBar`.
- `components/Dropdown.tsx` — themed dropdown (now unused after the picker moved to the modal; kept as
  a reusable component).
- UI theme = "Midnight Card Room": Fraunces (display) / Outfit (body) / Space Mono (numbers); design
  tokens + `.panel`/`.btn`/`.felt` in `index.css`.

## Resilience (server)
- Every socket handler is registered through a `safe`/`on` wrapper in `socketHandlers.ts` that
  try/catches — a throw in one handler can't crash the process (which would drop **every** table).
- `index.ts` adds `uncaughtException` / `unhandledRejection` logging (last-resort), tuned
  `pingInterval`/`pingTimeout` (20s/20s), and Socket.IO `connectionStateRecovery` (brief drops
  recover seamlessly). The client retries reconnection forever.

## Deployment & scale
- **Single-host:** the server serves `client/dist` when present, so the whole app runs as one Node
  service (Render/Railway/Fly). See `DEPLOY.md` + `render.yaml`.
- **Capacity:** one instance easily handles ~100 players across ~15 tables (light load). Fine as-is.
- **Free-tier idle spin-down (the big one):** free hosts gauge "idle" by **HTTP requests**, and a live
  WebSocket sends none → they spin the server down **mid-game** (~15 min) and wipe all tables. The
  client keep-alive (`useRoom.ts`, prod only) pings `/health` every 4 min while a table is open;
  for always-on, point an external uptime pinger at `/health`. See `DEPLOY.md` for both. Cold start
  ~50s; the client shows "Reconnecting…" then "Table unavailable" if the room is gone.
- **Limits (single instance, in-memory):** a restart/redeploy/crash **wipes all active games**. For
  real always-on use → small paid instance. To scale past thousands → Socket.IO Redis adapter + move
  room state into Redis/DB (and that would also make restarts non-destructive).

## Gotchas
- **In-memory state**: server restart loses every table (the client now degrades gracefully — see
  Reconnection UX). `tsx watch` restarts on file save during dev — expect active dev games to reset.
- **One browser = one identity** (session token in localStorage, keyed by room). Test multiple
  players with separate browsers / incognito / devices.
- Snapshots are **per-recipient** — don't leak data by broadcasting one shared payload; always go
  through `Room.snapshotFor`.
- Hand evaluation/comparison is delegated to `pokersolver`; the selection/advisor logic forces
  specific hole cards via `bestHandUsing`, so don't replace it with a plain `solve` of the union.
- `pokersolver` is CommonJS — import the default and destructure (`import pkg from 'pokersolver'`).
