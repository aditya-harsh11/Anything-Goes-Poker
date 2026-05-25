import type { Card, RoomState, PublicPlayer } from '@poker/shared';
import type { FloatingReaction } from '../lib/useRoom';
import PlayingCard from './PlayingCard';

interface Props {
  state: RoomState;
  reactions: FloatingReaction[];
}

function statusBadge(p: PublicPlayer): { label: string; cls: string } | null {
  if (p.status === 'folded') return { label: 'Folded', cls: 'bg-slate-600' };
  if (p.status === 'allin') return { label: 'All-in', cls: 'bg-amber-600' };
  if (p.status === 'sittingout') return { label: 'Out', cls: 'bg-slate-700' };
  return null;
}

/** Position (in % of the container) for a seat, rotated so the viewer sits at the bottom. */
function seatPosition(seat: number, mySeat: number, n: number): { x: number; y: number } {
  const displayIndex = (seat - mySeat + n) % n;
  const theta = Math.PI / 2 + (displayIndex * 2 * Math.PI) / n;
  return { x: 50 + 46 * Math.cos(theta), y: 50 + 45 * Math.sin(theta) };
}

function Seat({
  player,
  isYou,
  isToAct,
  isLeader,
  isSmallBlind,
  isBigBlind,
}: {
  player: PublicPlayer;
  isYou: boolean;
  isToAct: boolean;
  isLeader: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
}) {
  const badge = statusBadge(player);
  const dimmed = player.status === 'folded' || player.status === 'sittingout';
  const visible = player.holeCards ?? [];

  // Your own faces live in the bottom tray; your pod shows backs to avoid duplication.
  const faceCards: Card[] = isYou ? [] : visible;
  const backCount = isYou ? visible.length + player.cardBacks : player.cardBacks;
  const hasCards = faceCards.length > 0 || backCount > 0;

  return (
    <div
      className={`flex w-36 flex-col items-center gap-1 rounded-xl border px-2 py-2 transition ${
        isToAct ? 'active-glow border-yellow-400/70' : 'border-slate-700/80'
      } ${dimmed ? 'opacity-55' : ''} bg-slate-900/95 shadow-lg`}
    >
      <div className="flex h-10 items-center justify-center gap-0.5">
        {hasCards ? (
          <>
            {faceCards.map((c, i) => <PlayingCard key={`v${i}`} card={c} size="xs" />)}
            {Array.from({ length: backCount }).map((_, i) => <PlayingCard key={`b${i}`} hidden size="xs" />)}
          </>
        ) : (
          <div className="h-10" />
        )}
      </div>

      <div className="flex w-full items-center justify-between gap-1 text-sm">
        <span className={`truncate font-semibold ${isLeader ? 'text-amber-300' : 'text-slate-100'}`}>
          {isLeader && '👑 '}
          {player.name}
          {isYou ? ' (you)' : ''}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {player.isDealer && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-900">
              D
            </span>
          )}
          {isSmallBlind && (
            <span className="flex h-5 items-center justify-center rounded-full bg-sky-400 px-1 text-[10px] font-bold text-slate-900">
              SB
            </span>
          )}
          {isBigBlind && (
            <span className="flex h-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-slate-900">
              BB
            </span>
          )}
        </div>
      </div>

      <div className="flex w-full items-center justify-between">
        <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-base font-bold text-emerald-300">
          {player.stack.toLocaleString()}
        </span>
        {!player.isConnected && <span className="text-xs text-rose-400">offline</span>}
      </div>

      <div className="flex h-4 items-center gap-2 text-[11px]">
        {badge && <span className={`rounded px-1.5 py-0.5 text-white ${badge.cls}`}>{badge.label}</span>}
        {player.lastAction && !badge && <span className="text-slate-300">{player.lastAction}</span>}
      </div>
    </div>
  );
}

export default function Table({ state, reactions }: Props) {
  const { players, game, settings, youId } = state;
  const bySeat = new Map<number, PublicPlayer>();
  for (const p of players) bySeat.set(p.seat, p);

  const me = players.find((p) => p.id === youId);
  const mySeat = me ? me.seat : 0;
  const n = settings.maxSeats;

  // Chip leader gets a gold name — but only once stacks have diverged.
  const maxStack = Math.max(0, ...players.map((p) => p.stack));
  const allEqual = players.every((p) => p.stack === maxStack);

  const seats = [];
  for (let seat = 0; seat < n; seat++) {
    const { x, y } = seatPosition(seat, mySeat, n);
    const player = bySeat.get(seat);
    seats.push(
      <div
        key={seat}
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${x}%`, top: `${y}%` }}
      >
        {player ? (
          <Seat
            player={player}
            isYou={player.id === youId}
            isToAct={game.toAct === player.id}
            isLeader={!allEqual && player.stack === maxStack && maxStack > 0}
            isSmallBlind={game.smallBlindSeat === player.seat}
            isBigBlind={game.bigBlindSeat === player.seat}
          />
        ) : (
          <div className="flex h-24 w-36 items-center justify-center rounded-xl border-2 border-dashed border-slate-500/40 text-xs text-slate-400/70">
            Seat {seat + 1}
          </div>
        )}
        {player && player.committedThisRound > 0 && (
          <div className="mt-1 flex justify-center">
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-yellow-300">
              {player.committedThisRound.toLocaleString()}
            </span>
          </div>
        )}
      </div>,
    );
  }

  return (
    <div className="relative mx-auto aspect-[3/2] w-full max-w-5xl">
      <div className="felt absolute inset-[8%] rounded-[50%]" />

      {/* center: community cards + pot */}
      <div className="absolute left-1/2 top-1/2 flex w-full -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
        {game.communityCards2.length > 0 && (
          <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-100/80">Board A</span>
        )}
        <div className="flex gap-1.5">
          {game.communityCards.length > 0 ? (
            game.communityCards.map((c, i) => <PlayingCard key={i} card={c} size="md" />)
          ) : (
            <span className="text-sm text-emerald-100/70">
              {game.phase === 'waiting' ? 'Waiting for next hand' : ''}
            </span>
          )}
        </div>
        {game.communityCards2.length > 0 && (
          <>
            <span className="mt-1 text-[11px] font-bold uppercase tracking-widest text-emerald-100/80">Board B</span>
            <div className="flex gap-1.5">
              {game.communityCards2.map((c, i) => <PlayingCard key={i} card={c} size="md" />)}
            </div>
          </>
        )}
        {game.totalPot > 0 && (
          <div className="mt-1 rounded-full bg-slate-950/80 px-5 py-1.5 text-lg font-bold text-amber-300 ring-1 ring-amber-400/30">
            Pot {game.totalPot.toLocaleString()}
          </div>
        )}
      </div>

      {seats}

      {/* floating emoji reactions over the sender's seat */}
      {reactions.map((r) => {
        const p = players.find((pl) => pl.id === r.fromId);
        const pos = p ? seatPosition(p.seat, mySeat, n) : { x: 50, y: 60 };
        return (
          <div
            key={r.id}
            className="reaction-float pointer-events-none absolute z-20 text-4xl drop-shadow-lg"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            {r.emoji}
          </div>
        );
      })}
    </div>
  );
}
