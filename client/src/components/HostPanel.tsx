import { type RoomState, type Variant, VARIANT_LIST, VARIANTS } from '@poker/shared';
import { api } from '../lib/api';
import Dropdown from './Dropdown';

interface Props {
  state: RoomState;
}

export default function HostPanel({ state }: Props) {
  const { joinRequests = [], players, settings, game } = state;
  const handInProgress = game.phase !== 'waiting' && game.phase !== 'showdown';
  const eligible = players.filter((p) => p.status !== 'sittingout' && p.stack > 0).length;

  const promptSet = (playerId: string, current: number) => {
    const raw = window.prompt('Set stack to:', String(current));
    if (raw === null) return;
    const value = Math.max(0, Math.floor(Number(raw)));
    if (Number.isFinite(value)) api.setStack(playerId, value);
  };

  const heading = 'mb-2 font-display text-lg text-brass-bright';
  const label = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-dim';

  return (
    <aside className="panel flex w-full shrink-0 flex-col gap-5 rounded-2xl p-4 lg:w-72">
      <div>
        <h2 className={heading}>Host controls</h2>
        <label className={label}>Variant — next hand</label>
        <div className="mb-1">
          <Dropdown
            value={settings.variant}
            disabled={handInProgress}
            onChange={(v) => api.setVariant(v as Variant)}
            options={VARIANT_LIST.map((v) => ({ value: v.id, label: v.name }))}
          />
        </div>
        <p className="mb-3 text-xs text-ink-dim">{VARIANTS[settings.variant].description}</p>

        {game.handNumber === 0 && (
          <button
            onClick={() => api.shuffleSeats()}
            disabled={players.length < 2}
            className="btn btn-ghost mb-2 w-full py-2 text-sm"
          >
            🔀 Shuffle seats
          </button>
        )}
        <button
          onClick={() => api.startHand()}
          disabled={handInProgress || eligible < 2}
          className="btn btn-emerald w-full py-2.5"
        >
          {handInProgress ? 'Hand in progress' : 'Start hand'}
        </button>
        {eligible < 2 && <p className="mt-1 text-xs text-ink-dim">Need at least 2 players with chips.</p>}
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
              <div className="flex gap-2">
                <button
                  onClick={() => api.adjustStack(p.id, settings.startingStack)}
                  className="btn btn-ghost flex-1 py-1.5 text-xs"
                >
                  + buy-in
                </button>
                <button onClick={() => promptSet(p.id, p.stack)} className="btn btn-ghost flex-1 py-1.5 text-xs">
                  Set
                </button>
                {p.id !== state.hostId && (
                  <button onClick={() => api.removePlayer(p.id)} className="btn btn-danger flex-1 py-1.5 text-xs">
                    Kick
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
