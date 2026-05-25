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

  // Reset the raise amount each time it becomes our turn / the minimum changes.
  useEffect(() => {
    if (av) setRaiseTo(av.minRaiseTo);
  }, [av?.minRaiseTo, av?.maxRaiseTo, state.game.toAct]);

  if (!isMyTurn || !av || !me) {
    return (
      <div className="flex h-20 items-center justify-center text-sm text-slate-500">
        {state.game.toAct
          ? `Waiting for ${state.players.find((p) => p.id === state.game.toAct)?.name ?? 'player'}…`
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
    <div className="flex h-20 items-center justify-center gap-4 px-4">
      <div className="flex gap-2">
        {!av.canCheck && (
          <button
            onClick={() => onAct({ type: 'fold' })}
            className="rounded-lg bg-rose-700 px-5 py-3 font-semibold text-white hover:bg-rose-600"
          >
            Fold
          </button>
        )}
        {av.canCheck ? (
          <button
            onClick={() => onAct({ type: 'check' })}
            className="rounded-lg bg-slate-600 px-5 py-3 font-semibold text-white hover:bg-slate-500"
          >
            Check
          </button>
        ) : (
          <button
            onClick={() => onAct({ type: 'call' })}
            disabled={!av.canCall}
            className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            Call {av.callAmount.toLocaleString()}
          </button>
        )}
      </div>

      {canAggress && (
        <div className="flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-2">
          <input
            type="range"
            min={av.minRaiseTo}
            max={av.maxRaiseTo}
            value={raiseTo}
            onChange={(e) => setRaiseTo(Number(e.target.value))}
            className="w-40"
          />
          <input
            type="number"
            min={av.minRaiseTo}
            max={av.maxRaiseTo}
            value={raiseTo}
            onChange={(e) => setRaiseTo(clamp(Number(e.target.value)))}
            className="w-24 rounded bg-slate-900 px-2 py-1 text-right font-mono"
          />
          <div className="flex gap-1">
            {quick.map((q) => (
              <button
                key={q.label}
                onClick={() => setRaiseTo(q.to)}
                className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
              >
                {q.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => onAct({ type: av.canBet ? 'bet' : 'raise', amount: clamp(raiseTo) })}
            className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-500"
          >
            {aggressLabel} {clamp(raiseTo).toLocaleString()}
          </button>
        </div>
      )}
    </div>
  );
}
