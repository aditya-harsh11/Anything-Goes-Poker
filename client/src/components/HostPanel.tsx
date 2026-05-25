import { type RoomState, type Variant, VARIANT_LIST, VARIANTS } from '@poker/shared';
import { api } from '../lib/api';

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

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 rounded-xl bg-slate-900 p-4">
      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">Host controls</h2>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Variant (next hand)
        </label>
        <select
          value={settings.variant}
          disabled={handInProgress}
          onChange={(e) => api.setVariant(e.target.value as Variant)}
          className="mb-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {VARIANT_LIST.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <p className="mb-2 text-xs text-slate-500">{VARIANTS[settings.variant].description}</p>
        <button
          onClick={() => api.startHand()}
          disabled={handInProgress || eligible < 2}
          className="w-full rounded-lg bg-emerald-600 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          {handInProgress ? 'Hand in progress' : 'Start hand'}
        </button>
        {eligible < 2 && (
          <p className="mt-1 text-xs text-slate-500">Need at least 2 players with chips.</p>
        )}
      </div>

      {joinRequests.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-400">
            Join requests
          </h3>
          <ul className="flex flex-col gap-2">
            {joinRequests.map((r) => (
              <li key={r.requestId} className="rounded-lg bg-slate-800 p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{r.name}</span>
                  <span className="font-mono text-emerald-300">{r.buyIn.toLocaleString()}</span>
                </div>
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => api.approveJoin(r.requestId)}
                    className="flex-1 rounded bg-emerald-600 py-1 text-xs font-semibold hover:bg-emerald-500"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => api.rejectJoin(r.requestId)}
                    className="flex-1 rounded bg-rose-700 py-1 text-xs font-semibold hover:bg-rose-600"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Manage chips</h3>
        <ul className="flex flex-col gap-2">
          {players.map((p) => (
            <li key={p.id} className="rounded-lg bg-slate-800 p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="truncate font-semibold">{p.name}</span>
                <span className="font-mono text-emerald-300">{p.stack.toLocaleString()}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <button
                  onClick={() => api.adjustStack(p.id, settings.startingStack)}
                  className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                >
                  + buy-in
                </button>
                <button
                  onClick={() => promptSet(p.id, p.stack)}
                  className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                >
                  Set
                </button>
                {p.id !== state.hostId && (
                  <button
                    onClick={() => api.removePlayer(p.id)}
                    className="rounded bg-rose-800 px-2 py-1 text-xs hover:bg-rose-700"
                  >
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
