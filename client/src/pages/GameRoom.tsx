import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SUIT_SYMBOL, VARIANTS, selectionHint, type RoomState } from '@poker/shared';
import { socket } from '../lib/socket';
import { useRoom } from '../lib/useRoom';
import { joinRoom, rejoin, api } from '../lib/api';
import { loadSession, saveSession, clearSession } from '../lib/session';
import Table from '../components/Table';
import ActionBar from '../components/ActionBar';
import HostPanel from '../components/HostPanel';
import PlayingCard from '../components/PlayingCard';

function ResultBanner({ state }: { state: RoomState }) {
  const r = state.lastResult;
  if (!r || state.game.phase !== 'showdown') return null;
  return (
    <div className="rounded-lg bg-black/50 px-4 py-2 text-center text-sm">
      {r.winners.length === 0 ? (
        <span className="text-slate-300">Hand complete</span>
      ) : (
        r.winners.map((w, i) => (
          <span key={`${w.playerId}-${w.board ?? ''}-${i}`} className="mr-3 font-semibold text-yellow-300">
            {w.name} wins {w.amount.toLocaleString()}
            {w.board ? ` (Board ${w.board})` : ''}
          </span>
        ))
      )}
    </div>
  );
}

/**
 * Shows the viewer's own cards large. In Crazy Pineapple they pick a card to discard;
 * at a manual-select showdown they pick which cards to use.
 */
function PlayerHand({ state }: { state: RoomState }) {
  const me = state.players.find((p) => p.id === state.youId);
  const cards = me?.holeCards ?? [];
  const variant = VARIANTS[state.settings.variant];
  const mode: 'discard' | 'select' | 'none' = state.youMustDiscard
    ? 'discard'
    : state.youMustSelect
      ? 'select'
      : 'none';
  const [sel, setSel] = useState<number[]>([]);

  if (cards.length === 0) return null;

  const toggle = (i: number) => {
    if (mode === 'discard') {
      setSel((cur) => (cur[0] === i ? [] : [i]));
    } else {
      setSel((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
    }
  };
  const ringColor = mode === 'discard' ? 'ring-rose-400' : 'ring-emerald-400';
  const canConfirm = mode === 'discard' ? sel.length === 1 : variant.allowedHoleCounts.includes(sel.length);

  const confirm = () => {
    if (mode === 'discard') api.discardCard(sel[0]);
    else api.selectCards(sel);
  };

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="flex items-end gap-2">
        {cards.map((card, i) => {
          const selected = sel.includes(i);
          return (
            <button
              key={i}
              onClick={mode !== 'none' ? () => toggle(i) : undefined}
              className={`rounded-md transition ${mode !== 'none' ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'} ${
                selected ? `-translate-y-2 rounded-lg ring-4 ${ringColor}` : ''
              }`}
            >
              <PlayingCard card={card} size="lg" />
            </button>
          );
        })}
      </div>
      {mode === 'discard' && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-300">Pick a card to discard — {sel.length}/1 chosen</span>
          <button
            disabled={!canConfirm}
            onClick={confirm}
            className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-500 disabled:opacity-40"
          >
            Discard
          </button>
        </div>
      )}
      {mode === 'select' && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-300">
            Choose {selectionHint(variant.allowedHoleCounts)} — {sel.length} selected
          </span>
          <button
            disabled={!canConfirm}
            onClick={confirm}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}

/** After a hand, let the player opt to reveal their own hole cards. */
function ShowHandControls({ state }: { state: RoomState }) {
  const me = state.players.find((p) => p.id === state.youId);
  const cards = me?.holeCards ?? [];
  if (state.game.phase !== 'showdown' || state.game.awaitingSelection || cards.length === 0) return null;
  const shown = me?.shown ?? [];
  const allShown = cards.every((_, i) => shown.includes(i));

  return (
    <div className="flex items-center justify-center gap-2 py-2 text-sm">
      <span className="text-slate-400">Show your cards:</span>
      {cards.map((c, i) => (
        <button
          key={i}
          disabled={shown.includes(i)}
          onClick={() => api.showCards([i])}
          className="rounded bg-slate-700 px-3 py-1.5 hover:bg-slate-600 disabled:opacity-40"
        >
          {shown.includes(i) ? 'Shown ' : 'Show '}
          {c.rank}
          {SUIT_SYMBOL[c.suit]}
        </button>
      ))}
      <button
        disabled={allShown}
        onClick={() => api.showCards(cards.map((_, i) => i))}
        className="rounded bg-indigo-600 px-3 py-1.5 font-semibold hover:bg-indigo-500 disabled:opacity-40"
      >
        Show both
      </button>
    </div>
  );
}

/** Buy-in / stack / net summary for settling up after the session. */
function Ledger({ state, onClose }: { state: RoomState; onClose: () => void }) {
  const rows = [...state.players].sort((a, b) => b.netResult - a.netResult);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-slate-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ledger</h2>
          <button onClick={onClose} className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600">
            Close
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-1">Player</th>
              <th className="pb-1 text-right">Bought in</th>
              <th className="pb-1 text-right">Stack</th>
              <th className="pb-1 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-slate-800">
                <td className="py-1.5 font-medium">{p.name}</td>
                <td className="py-1.5 text-right font-mono text-slate-300">{p.boughtIn.toLocaleString()}</td>
                <td className="py-1.5 text-right font-mono text-emerald-300">{p.stack.toLocaleString()}</td>
                <td
                  className={`py-1.5 text-right font-mono ${p.netResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {p.netResult >= 0 ? '+' : ''}
                  {p.netResult.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-500">
          Net = current stack − total bought in. Positive is up for the session, negative is down.
        </p>
      </div>
    </div>
  );
}

function ShareBar({ roomId }: { roomId: string }) {
  const url = `${window.location.origin}/game/${roomId}`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-400">Invite:</span>
      <code className="rounded bg-slate-800 px-2 py-1 text-emerald-300">{url}</code>
      <button
        onClick={() => {
          navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

export default function GameRoom() {
  const { roomId: rawId } = useParams();
  const roomId = (rawId ?? '').toLowerCase();
  const navigate = useNavigate();
  const { state, error, connected } = useRoom();

  const [needJoin, setNeedJoin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [showLedger, setShowLedger] = useState(false);

  // Register/re-register our session on first connect AND on every reconnect, so a
  // dropped socket automatically reclaims our seat instead of going "offline".
  useEffect(() => {
    const attemptRejoin = () => {
      const session = loadSession(roomId);
      if (!session) {
        setNeedJoin(true);
        return;
      }
      rejoin(roomId, session.token).then((ack) => {
        if (ack.ok) {
          setNeedJoin(false);
        } else {
          clearSession(roomId);
          setNeedJoin(true);
        }
      });
    };

    if (socket.connected) attemptRejoin();
    socket.on('connect', attemptRejoin);
    return () => {
      socket.off('connect', attemptRejoin);
    };
  }, [roomId]);

  const doJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ack = await joinRoom(roomId, name || 'Player');
    setBusy(false);
    if (ack.ok) {
      saveSession(roomId, { playerId: ack.playerId, token: ack.token });
      setNeedJoin(false);
    } else {
      window.alert(ack.error);
    }
  };

  const leave = () => {
    api.leaveRoom();
    clearSession(roomId);
    navigate('/');
  };

  // Join form (no session yet).
  if (needJoin && !state) {
    return (
      <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-4 p-6">
        <h1 className="text-center text-2xl font-bold text-emerald-400">Join game</h1>
        <p className="text-center text-sm text-slate-400">
          Room <code className="text-emerald-300">{roomId}</code>
        </p>
        <form onSubmit={doJoin} className="flex flex-col gap-3 rounded-2xl bg-slate-900 p-6">
          <input
            className="rounded-lg bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            disabled={busy}
            className="rounded-lg bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? 'Joining…' : 'Request to join'}
          </button>
          <p className="text-center text-xs text-slate-500">The host sets your chips once you're approved.</p>
        </form>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-full items-center justify-center text-slate-400">
        {connected ? 'Loading table…' : 'Connecting…'}
      </div>
    );
  }

  const me = state.players.find((p) => p.id === state.youId);

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-3 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-emerald-400">♠ Card Room</h1>
          <span className="text-xs text-slate-500">
            {state.settings.smallBlind}/{state.settings.bigBlind} blinds · hand #{state.game.handNumber}
          </span>
        </div>
        <ShareBar roomId={state.roomId} />
        <div className="flex items-center gap-2">
          {!connected && <span className="text-xs text-rose-400">reconnecting…</span>}
          <button
            onClick={() => setShowLedger(true)}
            className="rounded bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
          >
            Ledger
          </button>
          {me && me.status === 'sittingout' ? (
            <button onClick={() => api.sitIn()} className="rounded bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600">
              Sit in
            </button>
          ) : (
            me && (
              <button onClick={() => api.sitOut()} className="rounded bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600">
                Sit out
              </button>
            )
          )}
          <button onClick={leave} className="rounded bg-rose-800 px-3 py-1.5 text-sm hover:bg-rose-700">
            Leave
          </button>
        </div>
      </header>

      {state.youStatus === 'pending' && (
        <div className="rounded-lg bg-amber-900/60 px-4 py-2 text-center text-sm text-amber-200">
          Waiting for the host to approve you…
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-rose-900/70 px-4 py-2 text-center text-sm text-rose-200">{error}</div>
      )}

      <div className="flex flex-1 gap-4">
        <main className="flex flex-1 flex-col gap-3">
          <ResultBanner state={state} />
          <Table state={state} />
          <div className="flex flex-col rounded-xl bg-slate-900 p-2">
            {state.youNote && (
              <div className="mb-1 rounded-lg bg-sky-900/60 px-4 py-2 text-center text-sm text-sky-200">
                💡 {state.youNote}
              </div>
            )}
            <PlayerHand key={state.game.handNumber} state={state} />
            {((state.game.awaitingSelection && !state.youMustSelect) ||
              (state.game.awaitingDiscard && !state.youMustDiscard)) && (
              <div className="flex items-center justify-center gap-3 py-1 text-sm text-slate-400">
                {state.game.awaitingDiscard
                  ? 'Waiting for players to discard…'
                  : 'Waiting for players to choose their cards…'}
                {state.youAreHost && (
                  <button
                    onClick={() => api.forceShowdown()}
                    className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
                  >
                    {state.game.awaitingDiscard ? 'Force discard' : 'Reveal now'}
                  </button>
                )}
              </div>
            )}
            <ShowHandControls state={state} />
            <ActionBar state={state} onAct={(a) => api.act(a)} />
          </div>
        </main>
        {state.youAreHost && <HostPanel state={state} />}
      </div>

      {showLedger && <Ledger state={state} onClose={() => setShowLedger(false)} />}
    </div>
  );
}
