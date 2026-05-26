import { useState } from 'react';
import { type RoomState } from '@poker/shared';
import { api } from '../lib/api';

interface Props {
  state: RoomState;
}

export default function HostPanel({ state }: Props) {
  const { joinRequests = [], players, settings, game } = state;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  const startEdit = (playerId: string, current: number) => {
    setEditingId(playerId);
    setEditVal(String(current));
  };
  const applyEdit = (playerId: string) => {
    const value = Math.max(0, Math.floor(Number(editVal)));
    if (Number.isFinite(value)) api.setStack(playerId, value);
    setEditingId(null);
  };

  const heading = 'mb-2 font-display text-lg text-brass-bright';

  // Deal section: only meaningful when the table is idle between hands.
  const handIdle =
    (game.phase === 'waiting' || game.phase === 'showdown') &&
    !game.awaitingSelection &&
    !game.awaitingDiscard;
  const eligible = players.filter((p) => p.status !== 'sittingout' && p.stack > 0).length;
  const dealer = players.find((p) => p.id === state.nextDealerId);
  const firstHand = game.handNumber === 0;
  const startLabel = firstHand ? 'Start game' : 'Deal next hand';

  return (
    <aside className="panel flex w-full flex-col gap-4 rounded-2xl p-3 sm:p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
      <div>
        <h2 className={heading}>Host controls</h2>

        {handIdle && state.awaitingDealerPick ? (
          // Mid-selection: dealer is on the clock to pick the variant. The host can't
          // deal — they just see who they're waiting on.
          <div className="mb-3 rounded-xl bg-brass/10 p-3 ring-1 ring-brass/25">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-brass-bright">
              Dealer's choice
            </div>
            <p className="text-xs text-ink-dim">
              Waiting for{' '}
              <span className="font-semibold text-brass-bright">{dealer?.name ?? 'the dealer'}</span>{' '}
              to pick the game. The hand deals as soon as they choose.
            </p>
          </div>
        ) : handIdle ? (
          <div className="mb-3 rounded-xl bg-black/35 p-3 ring-1 ring-brass/15">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-brass">
              {firstHand ? 'Ready to start' : 'Hand complete'}
            </div>
            <p className="mb-2 text-xs text-ink-dim">
              {dealer ? (
                <>
                  Dealer <span className="font-semibold text-brass-bright">{dealer.name}</span> picks the game
                  once you start.
                </>
              ) : (
                'Need at least 2 players to begin.'
              )}
            </p>
            <button
              onClick={() => api.startHand()}
              disabled={eligible < 2}
              className="btn btn-emerald w-full py-2.5 text-sm"
            >
              {startLabel}
            </button>
            {eligible < 2 && (
              <p className="mt-1 text-[11px] text-ink-dim">Need at least 2 players with chips.</p>
            )}
          </div>
        ) : (
          <p className="mb-3 text-xs text-ink-dim">
            Hand in progress. You can manage chips, approvals and seating below.
          </p>
        )}

        {game.handNumber === 0 && (
          <button
            onClick={() => api.shuffleSeats()}
            disabled={players.length < 2}
            className="btn btn-ghost w-full py-2 text-sm"
          >
            Shuffle seats
          </button>
        )}
      </div>

      {joinRequests.length > 0 && (
        <div>
          <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-brass">Join requests</h3>
          <ul className="flex flex-col gap-2">
            {joinRequests.map((r) => (
              <li key={r.requestId} className="rounded-xl bg-black/30 p-3 ring-1 ring-brass/10">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{r.name}</span>
                  <span className="font-mono text-emerald-300">{r.buyIn.toLocaleString()}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => api.approveJoin(r.requestId)} className="btn btn-emerald flex-1 py-1.5 text-xs">
                    Approve
                  </button>
                  <button onClick={() => api.rejectJoin(r.requestId)} className="btn btn-danger flex-1 py-1.5 text-xs">
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-ink-dim">Manage chips</h3>
        <ul className="flex flex-col gap-2">
          {players.map((p) => (
            <li key={p.id} className="rounded-xl bg-black/30 p-3 ring-1 ring-brass/10">
              <div className="mb-2 flex items-center justify-between">
                <span className="truncate font-semibold">{p.name}</span>
                <span className="font-mono font-bold text-emerald-300">{p.stack.toLocaleString()}</span>
              </div>
              {editingId === p.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    autoFocus
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyEdit(p.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="field flex-1 py-1.5 text-sm"
                  />
                  <button onClick={() => applyEdit(p.id)} className="btn btn-emerald px-3 py-1.5 text-xs">
                    Set
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn btn-ghost px-3 py-1.5 text-xs">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => api.adjustStack(p.id, settings.startingStack)}
                    className="btn btn-ghost flex-1 py-1.5 text-xs"
                  >
                    + buy-in
                  </button>
                  <button onClick={() => startEdit(p.id, p.stack)} className="btn btn-ghost flex-1 py-1.5 text-xs">
                    Set
                  </button>
                  {p.id !== state.hostId && (
                    <button onClick={() => api.removePlayer(p.id)} className="btn btn-danger flex-1 py-1.5 text-xs">
                      Kick
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
