import { useEffect, useState } from 'react';
import type { RoomState, PlayerAction } from '@poker/shared';

interface Props {
  state: RoomState;
  onAct: (action: PlayerAction) => void;
}

export default function ActionBar({ state, onAct }: Props) {
  const av = state.availableActions;
  const me = state.players.find((p) => p.id === state.youId);
  const isMyTurn = !!av && state.game.toAct === state.youId;

  const [raiseTo, setRaiseTo] = useState(av?.minRaiseTo ?? 0);

  useEffect(() => {
    if (av) setRaiseTo(av.minRaiseTo);
  }, [av?.minRaiseTo, av?.maxRaiseTo, state.game.toAct]);

  if (!isMyTurn || !av || !me) {
    return (
      <div className="flex h-16 items-center justify-center text-sm text-ink-dim">
        {state.game.toAct
          ? `Waiting on ${state.players.find((p) => p.id === state.game.toAct)?.name ?? 'player'}…`
          : 'Waiting for the next hand…'}
      </div>
    );
  }

  const pot = state.game.totalPot;
  const matchTo = state.game.currentBet;
  const canAggress = av.canBet || av.canRaise;
  const aggressLabel = av.canBet ? 'Bet' : 'Raise to';

  const clamp = (v: number) => Math.max(av.minRaiseTo, Math.min(av.maxRaiseTo, Math.round(v)));
  const quick = [
    { label: '½ Pot', to: clamp(matchTo + Math.floor(pot / 2)) },
    { label: 'Pot', to: clamp(matchTo + pot) },
    { label: 'All-in', to: av.maxRaiseTo },
  ];

  return (
    <div className="flex min-h-16 flex-wrap items-center justify-center gap-3 px-2 py-2">
      <div className="flex gap-2">
        {!av.canCheck && (
          <button onClick={() => onAct({ type: 'fold' })} className="btn btn-danger px-6 py-3">
            Fold
          </button>
        )}
        {av.canCheck ? (
          <button onClick={() => onAct({ type: 'check' })} className="btn btn-ghost px-6 py-3">
            Check
          </button>
        ) : (
          <button
            onClick={() => onAct({ type: 'call' })}
            disabled={!av.canCall}
            className="btn btn-emerald px-6 py-3"
          >
            Call {av.callAmount.toLocaleString()}
          </button>
        )}
      </div>

      {canAggress && (
        <div className="flex w-full flex-wrap items-center justify-center gap-2.5 rounded-2xl bg-black/30 px-3 py-2 ring-1 ring-brass/15 sm:w-auto sm:gap-3">
          <input
            type="range"
            min={av.minRaiseTo}
            max={av.maxRaiseTo}
            value={raiseTo}
            onChange={(e) => setRaiseTo(Number(e.target.value))}
            className="h-2 w-full cursor-pointer accent-[#c9a66b] sm:min-w-[12rem] sm:flex-1"
          />
          <input
            type="number"
            min={av.minRaiseTo}
            max={av.maxRaiseTo}
            value={raiseTo}
            onChange={(e) => setRaiseTo(Number(e.target.value))}
            onBlur={() => setRaiseTo(clamp(raiseTo))}
            className="w-24 rounded-lg border border-brass/30 bg-black/40 px-2 py-1.5 text-center font-mono text-lg font-bold text-ink outline-none focus:border-brass/60"
          />
          <div className="flex gap-1.5">
            {quick.map((q) => (
              <button key={q.label} onClick={() => setRaiseTo(q.to)} className="btn btn-ghost px-3.5 py-2 text-sm">
                {q.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => onAct({ type: av.canBet ? 'bet' : 'raise', amount: clamp(raiseTo) })}
            className="btn btn-gold px-6 py-3"
          >
            {aggressLabel} {clamp(raiseTo).toLocaleString()}
          </button>
        </div>
      )}
    </div>
  );
}
