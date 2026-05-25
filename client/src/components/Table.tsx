import { useEffect, useRef, useState } from 'react';
import type { Card, RoomState, PublicPlayer } from '@poker/shared';
import type { FloatingReaction } from '../lib/useRoom';
import PlayingCard from './PlayingCard';

interface Props {
  state: RoomState;
  reactions: FloatingReaction[];
}

const DESIGN_W = 900;
const DESIGN_H = 600;

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
  isLeader,
  isSmallBlind,
  isBigBlind,
  hideCards,
}: {
  player: PublicPlayer;
  isYou: boolean;
  isToAct: boolean;
  isLeader: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  hideCards: boolean;
}) {
  const badge = statusBadge(player);
  const dimmed = player.status === 'folded' || player.status === 'sittingout';
  const visible = player.holeCards ?? [];

  let faceCards: Card[] = [];
  let backCount = 0;
  if (isYou) {
    faceCards = hideCards ? [] : visible;
  } else {
    faceCards = visible;
    backCount = player.cardBacks;
  }
  const hasCards = faceCards.length > 0 || backCount > 0;

  return (
    <div
      className={`panel flex flex-col items-center gap-0.5 rounded-2xl px-2.5 pb-2 pt-1.5 ${
        isYou ? 'min-w-36' : 'w-36'
      } ${isToAct ? 'active-glow' : ''} ${dimmed ? 'opacity-55' : ''}`}
    >
      {hasCards && (
        <div className="flex min-h-11 items-center justify-center gap-0.5">
          {faceCards.map((c, i) => <PlayingCard key={`v${i}`} card={c} size={isYou ? 'sm' : 'xs'} />)}
          {Array.from({ length: backCount }).map((_, i) => <PlayingCard key={`b${i}`} hidden size="xs" />)}
        </div>
      )}

      <div className="flex w-full items-center justify-between gap-1">
        <span className={`truncate text-sm font-semibold ${isLeader ? 'text-brass-bright' : 'text-ink'}`}>
          {isLeader && '👑 '}
          {player.name}
          {isYou ? ' (you)' : ''}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {player.isDealer && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-black">
              D
            </span>
          )}
          {isSmallBlind && (
            <span className="flex h-5 items-center justify-center rounded-full bg-sky-300 px-1 text-[10px] font-bold text-black">
              SB
            </span>
          )}
          {isBigBlind && (
            <span className="flex h-5 items-center justify-center rounded-full bg-brass px-1 text-[10px] font-bold text-black">
              BB
            </span>
          )}
        </div>
      </div>

      <div className="flex w-full items-center justify-between">
        <span className="font-mono text-base font-bold text-emerald-300">{player.stack.toLocaleString()}</span>
        {!player.isConnected && <span className="text-xs text-crimson">offline</span>}
      </div>

      <div className="flex min-h-5 items-center gap-2 text-center leading-tight">
        {badge ? (
          <span className={`rounded px-1.5 py-0.5 text-[11px] ${badge.cls}`}>{badge.label}</span>
        ) : player.handName ? (
          <span className="text-xs text-brass">{player.handName}</span>
        ) : player.lastAction ? (
          <span className="text-sm font-semibold text-ink-dim">{player.lastAction}</span>
        ) : null}
      </div>
    </div>
  );
}

export default function Table({ state, reactions }: Props) {
  const { players, game, settings, youId } = state;
  const choosing = !!(state.youMustSelect || state.youMustDiscard);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / DESIGN_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bySeat = new Map<number, PublicPlayer>();
  for (const p of players) bySeat.set(p.seat, p);
  const me = players.find((p) => p.id === youId);
  const mySeat = me ? me.seat : 0;
  const n = settings.maxSeats;

  const maxStack = Math.max(0, ...players.map((p) => p.stack));
  const allEqual = players.every((p) => p.stack === maxStack);

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
            isLeader={!allEqual && player.stack === maxStack && maxStack > 0}
            isSmallBlind={game.smallBlindSeat === player.seat}
            isBigBlind={game.bigBlindSeat === player.seat}
            hideCards={player.id === youId && choosing}
          />
        ) : (
          <div className="flex h-20 w-32 items-center justify-center rounded-2xl border-2 border-dashed border-brass/25 text-xs text-ink-dim/70">
            Seat {seat + 1}
          </div>
        )}
        {player && player.committedThisRound > 0 && (
          <div className="mt-1 flex justify-center">
            <span className="rounded-full bg-black/70 px-2 py-0.5 font-mono text-xs font-bold text-brass-bright ring-1 ring-brass/30">
              {player.committedThisRound.toLocaleString()}
            </span>
          </div>
        )}
      </div>,
    );
  }

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden" style={{ height: DESIGN_H * scale }}>
      <div
        className="absolute left-1/2 top-0"
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        <div className="felt absolute inset-[7%] rounded-[48%]" />

        <div className="absolute left-1/2 top-1/2 flex w-full -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
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
            <div className="mt-1 rounded-full bg-black/70 px-6 py-1.5 font-mono text-xl font-bold text-brass-bright ring-1 ring-brass/40">
              {game.totalPot.toLocaleString()}
            </div>
          )}
        </div>

        {seats}

        {reactions.map((r) => {
          const p = players.find((pl) => pl.id === r.fromId);
          const pos = p ? seatPosition(p.seat, mySeat, n) : { x: 50, y: 60 };
          return (
            <div
              key={r.id}
              className="reaction-float pointer-events-none absolute z-30 text-5xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              {r.emoji}
            </div>
          );
        })}
      </div>
    </div>
  );
}
