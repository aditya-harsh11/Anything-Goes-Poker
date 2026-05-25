import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SUIT_SYMBOL, VARIANTS, REACTIONS, selectionHint, type RoomState } from '@poker/shared';
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
    <div className="rounded-xl bg-black/40 px-4 py-2 text-center text-sm ring-1 ring-brass/20">
      {r.winners.length === 0 ? (
        <span className="text-ink-dim">Hand complete</span>
      ) : (
        r.winners.map((w, i) => (
          <span key={`${w.playerId}-${w.board ?? w.label ?? ''}-${i}`} className="mr-3 font-semibold text-brass-bright">
            {w.name} wins {w.amount.toLocaleString()}
            {w.label ? ` (${w.label})` : w.board ? ` (Board ${w.board})` : ''}
          </span>
        ))
      )}
    </div>
  );
}

/** Only rendered when the player must choose cards (select or discard). */
function ChooseTray({ state }: { state: RoomState }) {
  const me = state.players.find((p) => p.id === state.youId);
  const cards = me?.holeCards ?? [];
  const variant = VARIANTS[state.settings.variant];
  const mode: 'discard' | 'select' | 'none' = state.youMustDiscard
    ? 'discard'
    : state.youMustSelect
      ? 'select'
      : 'none';
  const [sel, setSel] = useState<number[]>([]);

  if (mode === 'none' || cards.length === 0) return null;

  const toggle = (i: number) => {
    if (mode === 'discard') setSel((cur) => (cur[0] === i ? [] : [i]));
    else setSel((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
  };
  const ringColor = mode === 'discard' ? 'ring-crimson' : 'ring-emerald-400';
  const canConfirm = mode === 'discard' ? sel.length === 1 : variant.allowedHoleCounts.includes(sel.length);
  const confirm = () => (mode === 'discard' ? api.discardCard(sel[0]) : api.selectCards(sel));

  return (
    <div className="flex flex-col items-center gap-2 border-b border-brass/15 pb-3">
      <div className="flex items-end gap-2">
        {cards.map((card, i) => {
          const selected = sel.includes(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`rounded-lg transition hover:-translate-y-1 ${selected ? `-translate-y-2 ring-4 ${ringColor}` : ''}`}
            >
              <PlayingCard card={card} size="md" />
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-ink-dim">
          {mode === 'discard'
            ? `Pick a card to discard — ${sel.length}/1`
            : variant.blackjack
              ? 'Pick 2 cards for poker (other 2 = blackjack)'
              : `Choose ${selectionHint(variant.allowedHoleCounts)}`}
        </span>
        <button
          disabled={!canConfirm}
          onClick={confirm}
          className={`btn px-5 py-2 ${mode === 'discard' ? 'btn-danger' : 'btn-emerald'}`}
        >
          {mode === 'discard' ? 'Discard' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}

/** After a hand, let the player reveal their own cards. */
function ShowHandControls({ state }: { state: RoomState }) {
  const me = state.players.find((p) => p.id === state.youId);
  const cards = me?.holeCards ?? [];
  if (state.game.phase !== 'showdown' || state.game.awaitingSelection || cards.length === 0) return null;
  const shown = me?.shown ?? [];
  const allShown = cards.every((_, i) => shown.includes(i));

  return (
    <div className="flex items-center justify-center gap-2 py-1 text-sm">
      <span className="text-ink-dim">Show:</span>
      {cards.map((c, i) => (
        <button key={i} disabled={shown.includes(i)} onClick={() => api.showCards([i])} className="btn btn-ghost px-3 py-1.5">
          {shown.includes(i) ? 'Shown ' : ''}
          {c.rank}
          <span className={c.suit === 'h' || c.suit === 'd' ? 'text-crimson' : ''}>{SUIT_SYMBOL[c.suit]}</span>
        </button>
      ))}
      <button disabled={allShown} onClick={() => api.showCards(cards.map((_, i) => i))} className="btn btn-gold px-3 py-1.5">
        Show both
      </button>
    </div>
  );
}

function ReactionBar() {
  return (
    <div className="flex items-center justify-center gap-1 rounded-full bg-black/35 px-3 py-1 ring-1 ring-brass/15">
      {REACTIONS.map((e) => (
        <button
          key={e}
          onClick={() => api.sendReaction(e)}
          className="rounded-full px-1.5 py-0.5 text-2xl transition hover:scale-125 hover:bg-white/5"
          title="Throw a reaction"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

function ShareBar({ roomId }: { roomId: string }) {
  const url = `${window.location.origin}/game/${roomId}`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-ink-dim">Invite</span>
      <code className="rounded-md bg-black/40 px-2 py-1 text-brass ring-1 ring-brass/15">{roomId}</code>
      <button
        onClick={() => {
          navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="btn btn-ghost px-2.5 py-1 text-xs"
      >
        {copied ? 'Copied!' : 'Copy link'}
      </button>
    </div>
  );
}

function Ledger({ state, onClose }: { state: RoomState; onClose: () => void }) {
  const rows = [...state.players].sort((a, b) => b.netResult - a.netResult);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="panel w-full max-w-md rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl text-brass-bright">Ledger</h2>
          <button onClick={onClose} className="btn btn-ghost px-3 py-1 text-xs">
            Close
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-dim">
              <th className="pb-1">Player</th>
              <th className="pb-1 text-right">Bought in</th>
              <th className="pb-1 text-right">Stack</th>
              <th className="pb-1 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-brass/10">
                <td className="py-1.5 font-medium">{p.name}</td>
                <td className="py-1.5 text-right font-mono text-ink-dim">{p.boughtIn.toLocaleString()}</td>
                <td className="py-1.5 text-right font-mono text-emerald-300">{p.stack.toLocaleString()}</td>
                <td className={`py-1.5 text-right font-mono ${p.netResult >= 0 ? 'text-emerald-400' : 'text-crimson'}`}>
                  {p.netResult >= 0 ? '+' : ''}
                  {p.netResult.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-ink-dim">Net = current stack − total bought in.</p>
      </div>
    </div>
  );
}

export default function GameRoom() {
  const { roomId: rawId } = useParams();
  const roomId = (rawId ?? '').toLowerCase();
  const navigate = useNavigate();
  const { state, error, connected, reactions } = useRoom();

  const [needJoin, setNeedJoin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [showLedger, setShowLedger] = useState(false);

  useEffect(() => {
    const attemptRejoin = () => {
      const session = loadSession(roomId);
      if (!session) {
        setNeedJoin(true);
        return;
      }
      rejoin(roomId, session.token).then((ack) => {
        if (ack.ok) setNeedJoin(false);
        else {
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

  if (needJoin && !state) {
    return (
      <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-4 p-6">
        <h1 className="text-center font-display text-3xl text-brass-bright">Take a seat</h1>
        <p className="text-center text-sm text-ink-dim">
          Room <code className="text-brass">{roomId}</code>
        </p>
        <form onSubmit={doJoin} className="panel flex flex-col gap-3 rounded-2xl p-6">
          <input className="field" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <button disabled={busy} className="btn btn-gold py-3">
            {busy ? 'Joining…' : 'Request to join'}
          </button>
          <p className="text-center text-xs text-ink-dim">The host sets your chips once you're approved.</p>
        </form>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-full items-center justify-center font-display text-xl text-ink-dim">
        {connected ? 'Loading table…' : 'Connecting…'}
      </div>
    );
  }

  const me = state.players.find((p) => p.id === state.youId);

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-3 p-3 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold text-brass-bright">Card Room</h1>
          <span className="rounded-md bg-brass/15 px-2.5 py-1 text-sm font-semibold text-brass-bright ring-1 ring-brass/30">
            {VARIANTS[state.settings.variant].name}
          </span>
          <span className="text-xs text-ink-dim">
            {state.settings.smallBlind}/{state.settings.bigBlind} · hand #{state.game.handNumber}
          </span>
        </div>
        <ShareBar roomId={state.roomId} />
        <div className="flex items-center gap-2">
          {!connected && <span className="text-xs text-crimson">reconnecting…</span>}
          <button onClick={() => setShowLedger(true)} className="btn btn-ghost px-3 py-1.5 text-sm">
            Ledger
          </button>
          {me && me.status === 'sittingout' ? (
            <button onClick={() => api.sitIn()} className="btn btn-ghost px-3 py-1.5 text-sm">
              Sit in
            </button>
          ) : (
            me && (
              <button onClick={() => api.sitOut()} className="btn btn-ghost px-3 py-1.5 text-sm">
                Sit out
              </button>
            )
          )}
          <button onClick={leave} className="btn btn-danger px-3 py-1.5 text-sm">
            Leave
          </button>
        </div>
      </header>

      {state.youStatus === 'pending' && (
        <div className="rounded-xl bg-brass/15 px-4 py-2 text-center text-sm text-brass-bright ring-1 ring-brass/25">
          Waiting for the host to approve you…
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-crimson/20 px-4 py-2 text-center text-sm text-crimson ring-1 ring-crimson/30">
          {error}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <main className="flex flex-1 flex-col gap-3">
          <ResultBanner state={state} />
          <Table state={state} reactions={reactions} />
          <div className="panel relative z-10 flex flex-col gap-1 rounded-2xl p-3">
            {state.youNote && (
              <div className="rounded-lg bg-emerald-500/10 px-4 py-2 text-center text-sm text-emerald-200 ring-1 ring-emerald-400/20">
                💡 {state.youNote}
              </div>
            )}
            <ChooseTray key={state.game.handNumber} state={state} />
            {((state.game.awaitingSelection && !state.youMustSelect) ||
              (state.game.awaitingDiscard && !state.youMustDiscard)) && (
              <div className="flex items-center justify-center gap-3 py-1 text-sm text-ink-dim">
                {state.game.awaitingDiscard ? 'Waiting for players to discard…' : 'Waiting for players to choose…'}
                {state.youAreHost && (
                  <button onClick={() => api.forceShowdown()} className="btn btn-ghost px-3 py-1 text-xs">
                    {state.game.awaitingDiscard ? 'Force discard' : 'Reveal now'}
                  </button>
                )}
              </div>
            )}
            <ShowHandControls state={state} />
            <ActionBar state={state} onAct={(a) => api.act(a)} />
            <div className="flex justify-center pt-1">
              <ReactionBar />
            </div>
          </div>
        </main>
        {state.youAreHost && <HostPanel state={state} />}
      </div>

      {showLedger && <Ledger state={state} onClose={() => setShowLedger(false)} />}
    </div>
  );
}
