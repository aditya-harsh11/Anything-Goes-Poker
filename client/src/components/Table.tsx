import { useEffect, useMemo, useRef, useState } from 'react';
import type { Card, RoomState, PublicPlayer } from '@poker/shared';
import PlayingCard from './PlayingCard';

interface Props {
  state: RoomState;
}

// Two design footprints — landscape for desktop's wide slot, portrait for the
// mobile slot (which is taller than wide). Seat math is percent-based so it
// works in either footprint without rewriting the position logic.
const LANDSCAPE = { w: 1150, h: 767 };
// Portrait is more elongated than the landscape aspect — gives the racetrack a
// clearly tall body (the "0" look) instead of looking like a fat circle.
const PORTRAIT = { w: 640, h: 1200 };
// Cap scale to keep cards crisp; the table fits its slot otherwise.
const MAX_SCALE = 1.25;

// Seat pods sit outside the felt on an ellipse (radius below), so at the ellipse's
// horizontal/vertical extremes a pod's own half-width/height can stick out past the
// design canvas's edge (e.g. the leftmost-middle and rightmost-middle seats at 8
// players). Reserving this much extra canvas before fitting to the container keeps
// every pod inside the clip boundary instead of getting cut off by `overflow-hidden`
// (which, on the side next to the action rail, reads as "covered by the sidebar").
const SEAT_RADIUS_X = 47;
const SEAT_RADIUS_Y = 39;
const SEAT_HALF_W = 80; // px at design scale=1 (opponent pod is w-40 = 160px)
const SEAT_HALF_H = 48; // px at design scale=1 (measured pod height ≈ 92px)
function bleedMargin(designSize: number, radiusPct: number, halfPx: number): number {
  const overhang = halfPx - ((50 - radiusPct) / 100) * designSize;
  return Math.max(0, overhang) + 4; // +4px rounding buffer
}

function statusBadge(p: PublicPlayer): { label: string; cls: string } | null {
  if (p.status === 'folded') return { label: 'Folded', cls: 'bg-black/50 text-ink-dim' };
  if (p.status === 'allin') return { label: 'All-in', cls: 'bg-brass text-black' };
  if (p.status === 'sittingout') return { label: 'Out', cls: 'bg-black/50 text-ink-dim' };
  return null;
}

function seatPosition(seat: number, mySeat: number, n: number): { x: number; y: number } {
  const displayIndex = (seat - mySeat + n) % n;
  const theta = Math.PI / 2 + (displayIndex * 2 * Math.PI) / n;
  return { x: 50 + 47 * Math.cos(theta), y: 50 + 39 * Math.sin(theta) };
}

function Seat({
  player,
  isYou,
  isToAct,
  isWinner,
  isLeader,
  isSmallBlind,
  isBigBlind,
  hideCards,
  selection,
}: {
  player: PublicPlayer;
  isYou: boolean;
  isToAct: boolean;
  isWinner: boolean;
  isLeader: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  hideCards: boolean;
  selection?: number[];
}) {
  const badge = statusBadge(player);
  const dimmed = player.status === 'folded' || player.status === 'sittingout';
  const visible = player.holeCards ?? [];

  // Only ever render face-up cards (your own, or others' revealed cards). No face-down backs.
  const faceCards: Card[] = isYou ? (hideCards ? [] : visible) : visible;
  const hasCards = faceCards.length > 0;
  const sel = isYou ? selection : undefined;
  const hasSel = !!sel && sel.length > 0;
  // Winner glow trumps to-act ring (the hand is over by then anyway).
  const glowClass = isWinner ? 'winner-glow' : isToAct ? 'active-glow' : '';

  return (
    <div
      className={`panel flex flex-col items-center gap-0.5 rounded-2xl px-3 pb-2 pt-1.5 ${
        isYou ? 'min-w-40' : 'w-40'
      } ${glowClass} ${dimmed && !isWinner ? 'opacity-55' : ''}`}
    >
      {hasCards && (
        <div className="flex min-h-12 items-center justify-center gap-0.5">
          {faceCards.map((c, i) => (
            <div
              key={i}
              className={`rounded ${hasSel && !sel!.includes(i) ? 'opacity-35' : ''} ${
                hasSel && sel!.includes(i) ? 'ring-2 ring-emerald-400' : ''
              }`}
            >
              <PlayingCard card={c} size={isYou ? 'sm' : 'xs'} />
            </div>
          ))}
        </div>
      )}

      <div className="flex w-full items-center justify-between gap-1">
        <span className={`truncate text-base font-semibold ${isLeader ? 'text-brass-bright' : 'text-ink'}`}>
          {isLeader && '👑 '}
          {player.name}
          {isYou ? ' (you)' : ''}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {player.isDealer && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-black">
              D
            </span>
          )}
          {isSmallBlind && (
            <span className="flex h-6 items-center justify-center rounded-full bg-sky-300 px-1.5 text-[11px] font-bold text-black">
              SB
            </span>
          )}
          {isBigBlind && (
            <span className="flex h-6 items-center justify-center rounded-full bg-brass px-1.5 text-[11px] font-bold text-black">
              BB
            </span>
          )}
        </div>
      </div>

      <div className="flex w-full items-center justify-between">
        <span className="font-mono text-lg font-bold text-emerald-300">{player.stack.toLocaleString()}</span>
        {!player.isConnected && <span className="text-xs text-crimson">offline</span>}
      </div>

      <div className="flex min-h-5 items-center gap-2 text-center leading-tight">
        {badge ? (
          <span className={`rounded px-1.5 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
        ) : player.handName ? (
          <span className="text-sm text-brass">{player.handName}</span>
        ) : player.lastAction ? (
          <span className="text-sm font-semibold text-ink-dim">{player.lastAction}</span>
        ) : null}
      </div>
    </div>
  );
}

export default function Table({ state }: Props) {
  const { players, game, settings, youId } = state;
  const choosing = !!(state.youMustSelect || state.youMustDiscard);

  const wrapRef = useRef<HTMLDivElement>(null);
  // Pick portrait when the slot is meaningfully taller than wide (mobile);
  // otherwise landscape (desktop). Re-evaluated on resize, so a desktop user
  // rotating their phone or shrinking the window picks the right footprint.
  const [layout, setLayout] = useState({ scale: 1, design: LANDSCAPE });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      const design = h > w * 1.1 ? PORTRAIT : LANDSCAPE;
      const marginX = bleedMargin(design.w, SEAT_RADIUS_X, SEAT_HALF_W);
      const marginY = bleedMargin(design.h, SEAT_RADIUS_Y, SEAT_HALF_H);
      const scale = Math.min(
        w / (design.w + 2 * marginX),
        h / (design.h + 2 * marginY),
        MAX_SCALE,
      );
      setLayout({ scale, design });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { scale, design } = layout;

  const bySeat = new Map<number, PublicPlayer>();
  for (const p of players) bySeat.set(p.seat, p);
  const me = players.find((p) => p.id === youId);
  const mySeat = me ? me.seat : 0;
  const n = settings.maxSeats;

  const maxStack = Math.max(0, ...players.map((p) => p.stack));
  const allEqual = players.every((p) => p.stack === maxStack);

  // Winners (during showdown) get a pulsing glow on their seat tile.
  const winnerIds = useMemo(() => {
    if (game.phase !== 'showdown' || !state.lastResult) return new Set<string>();
    return new Set(state.lastResult.winners.map((w) => w.playerId));
  }, [game.phase, state.lastResult]);

  const seats = [];
  for (let seat = 0; seat < n; seat++) {
    const { x, y } = seatPosition(seat, mySeat, n);
    const player = bySeat.get(seat);
    seats.push(
      <div key={seat} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
        {player ? (
          <Seat
            player={player}
            isYou={player.id === youId}
            isToAct={game.toAct === player.id}
            isWinner={winnerIds.has(player.id)}
            isLeader={!allEqual && player.stack === maxStack && maxStack > 0}
            isSmallBlind={game.smallBlindSeat === player.seat}
            isBigBlind={game.bigBlindSeat === player.seat}
            hideCards={player.id === youId && choosing}
            selection={player.id === youId ? state.yourSelection : undefined}
          />
        ) : (
          <div className="flex h-22 w-36 items-center justify-center rounded-2xl border-2 border-dashed border-brass/25 text-sm text-ink-dim/70">
            Seat {seat + 1}
          </div>
        )}
        {player && player.committedThisRound > 0 && (
          <div className="mt-1 flex justify-center">
            <span className="rounded-full bg-black/70 px-2.5 py-0.5 font-mono text-sm font-bold text-brass-bright ring-1 ring-brass/30">
              {player.committedThisRound.toLocaleString()}
            </span>
          </div>
        )}
      </div>,
    );
  }

  return (
    <div ref={wrapRef} className="relative w-full min-h-[calc(100svh-5rem)] overflow-hidden lg:min-h-0 lg:flex-1">
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: design.w,
          height: design.h,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* rounded-full gives a true racetrack/pill: semicircle caps + straight
            sides. On the portrait mobile footprint this reads as a tall "0";
            on landscape it's a classic horizontal poker-table oval. */}
        <div className="felt absolute inset-[7%] rounded-full" />

        <div className="absolute left-1/2 top-1/2 flex w-full -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
          {game.tripleNineTarget != null && (
            <div className="mb-1 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 ring-1 ring-brass/40">
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-ink/70">Target</span>
              <span className="font-mono text-lg font-bold text-brass-bright">
                {String(game.tripleNineTarget).padStart(3, '0')}
              </span>
            </div>
          )}
          {game.communityCards2.length > 0 && (
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink/70">Board A</span>
          )}
          <div className="flex gap-2">
            {game.communityCards.length > 0 ? (
              game.communityCards.map((c, i) => <PlayingCard key={i} card={c} size="lg" />)
            ) : (
              <span className="font-display text-xl italic text-ink/55">
                {game.phase === 'waiting' ? 'awaiting the deal' : ''}
              </span>
            )}
          </div>
          {game.communityCards2.length > 0 && (
            <>
              <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-ink/70">Board B</span>
              <div className="flex gap-2">
                {game.communityCards2.map((c, i) => <PlayingCard key={i} card={c} size="lg" />)}
              </div>
            </>
          )}
          {game.totalPot > 0 && (
            <div className="mt-1 rounded-full bg-black/70 px-7 py-2 font-mono text-2xl font-bold text-brass-bright ring-1 ring-brass/40">
              {game.totalPot.toLocaleString()}
            </div>
          )}
        </div>

        {seats}
      </div>
    </div>
  );
}
