import type { RoomState, PublicPlayer } from '@poker/shared';
import PlayingCard from './PlayingCard';

interface Props {
  state: RoomState;
}

function statusBadge(p: PublicPlayer): { label: string; cls: string } | null {
  if (p.status === 'folded') return { label: 'Folded', cls: 'bg-gray-600' };
  if (p.status === 'allin') return { label: 'All-in', cls: 'bg-amber-600' };
  if (p.status === 'sittingout') return { label: 'Sitting out', cls: 'bg-gray-700' };
  return null;
}

function Seat({
  player,
  isYou,
  isToAct,
  isSmallBlind,
  isBigBlind,
}: {
  player: PublicPlayer;
  isYou: boolean;
  isToAct: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
}) {
  const badge = statusBadge(player);
  const dimmed = player.status === 'folded' || player.status === 'sittingout';
  const visible = player.holeCards ?? [];
  const backs = player.cardBacks;
  const hasCards = visible.length > 0 || backs > 0;

  return (
    <div
      className={`flex w-40 flex-col items-center gap-1 rounded-xl border px-2 py-2 shadow-lg transition ${
        isToAct ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-slate-700'
      } ${dimmed ? 'opacity-60' : ''} bg-slate-900/90`}
    >
      {/* hole cards */}
      <div className="flex h-10 items-center justify-center gap-0.5">
        {hasCards ? (
          <>
            {visible.map((c, i) => <PlayingCard key={`v${i}`} card={c} size="xs" />)}
            {Array.from({ length: backs }).map((_, i) => <PlayingCard key={`b${i}`} hidden size="xs" />)}
          </>
        ) : (
          <div className="h-10" />
        )}
      </div>

      <div className="flex w-full items-center justify-between text-sm">
        <span className="truncate font-semibold">
          {player.name}
          {isYou ? ' (you)' : ''}
        </span>
        <div className="ml-1 flex shrink-0 items-center gap-1">
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

      <div className="flex w-full items-center justify-between text-xs">
        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-emerald-300">
          {player.stack.toLocaleString()}
        </span>
        {!player.isConnected && <span className="text-rose-400">offline</span>}
      </div>

      <div className="flex h-4 items-center gap-2 text-[11px]">
        {badge && <span className={`rounded px-1.5 py-0.5 text-white ${badge.cls}`}>{badge.label}</span>}
        {player.lastAction && !badge && <span className="text-slate-400">{player.lastAction}</span>}
      </div>
    </div>
  );
}

export default function Table({ state }: Props) {
  const { players, game, settings, youId } = state;
  const bySeat = new Map<number, PublicPlayer>();
  for (const p of players) bySeat.set(p.seat, p);

  const me = players.find((p) => p.id === youId);
  const mySeat = me ? me.seat : 0;
  const n = settings.maxSeats;

  const seats = [];
  for (let seat = 0; seat < n; seat++) {
    const displayIndex = (seat - mySeat + n) % n;
    const theta = Math.PI / 2 + (displayIndex * 2 * Math.PI) / n;
    const x = 50 + 45 * Math.cos(theta);
    const y = 50 + 44 * Math.sin(theta);
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
            isSmallBlind={game.smallBlindSeat === player.seat}
            isBigBlind={game.bigBlindSeat === player.seat}
          />
        ) : (
          <div className="flex h-24 w-40 items-center justify-center rounded-xl border border-dashed border-slate-700 text-xs text-slate-600">
            Seat {seat + 1}
          </div>
        )}
        {/* chips committed this round */}
        {player && player.committedThisRound > 0 && (
          <div className="mt-1 text-center text-xs font-mono text-yellow-300">
            ● {player.committedThisRound.toLocaleString()}
          </div>
        )}
      </div>,
    );
  }

  return (
    <div className="relative mx-auto aspect-[3/2] w-full max-w-5xl">
      <div className="felt absolute inset-[8%] rounded-[50%]" />

      {/* center: community cards + pot */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
        {game.communityCards2.length > 0 && (
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-100/70">Board A</span>
        )}
        <div className="flex gap-2">
          {game.communityCards.length > 0
            ? game.communityCards.map((c, i) => <PlayingCard key={i} card={c} size="lg" />)
            : <span className="text-sm text-emerald-100/70">
                {game.phase === 'waiting' ? 'Waiting for next hand' : ''}
              </span>}
        </div>
        {game.communityCards2.length > 0 && (
          <>
            <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-100/70">Board B</span>
            <div className="flex gap-2">
              {game.communityCards2.map((c, i) => <PlayingCard key={i} card={c} size="lg" />)}
            </div>
          </>
        )}
        {game.totalPot > 0 && (
          <div className="mt-1 rounded-full bg-black/40 px-4 py-1 text-sm font-semibold text-yellow-200">
            Pot: {game.totalPot.toLocaleString()}
          </div>
        )}
      </div>

      {seats}
    </div>
  );
}
