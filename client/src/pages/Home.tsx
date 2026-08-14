import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoomSettings } from '@poker/shared';
import { createRoom } from '../lib/api';
import { saveSession } from '../lib/session';
import NumberField from '../components/NumberField';

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);
  const [startingStack, setStartingStack] = useState(1000);
  const [maxSeats, setMaxSeats] = useState(8);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const settings: RoomSettings = {
      variant: 'texas', // host changes the variant per hand at the table
      smallBlind,
      bigBlind,
      startingStack,
      maxSeats,
    };
    const ack = await createRoom(name || 'Host', settings);
    setBusy(false);
    if (ack.ok) {
      saveSession(ack.roomId, { playerId: ack.playerId, token: ack.token });
      navigate(`/game/${ack.roomId}`);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toLowerCase();
    if (code) navigate(`/game/${code}`);
  };

  const label = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-dim';

  return (
    <div className="relative mx-auto flex min-h-full max-w-md flex-col justify-center gap-7 p-6">
      <header className="rise-in text-center">
        <div className="mb-2 flex justify-center gap-2 text-2xl text-brass">
          <span>♠</span>
          <span className="text-crimson">♥</span>
          <span className="text-crimson">♦</span>
          <span>♣</span>
        </div>
        <h1 className="font-display text-5xl font-semibold leading-none text-ink">Play Poker</h1>
        <p className="mt-3 text-sm text-ink-dim">
          A private table for your home game. Play-chips only.
        </p>
      </header>

      <form
        onSubmit={handleCreate}
        className="panel rise-in flex flex-col gap-3 rounded-2xl p-6 shadow-2xl"
        style={{ animationDelay: '0.08s' }}
      >
        <h2 className="font-display text-2xl text-brass-bright">Open a table</h2>
        <div>
          <label className={label}>Your name</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Host" />
        </div>
        <p className="text-xs text-ink-dim">The dealer picks the game for each hand at the table.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Small blind</label>
            <NumberField min={1} className="field" value={smallBlind} onChange={setSmallBlind} />
          </div>
          <div>
            <label className={label}>Big blind</label>
            <NumberField min={1} className="field" value={bigBlind} onChange={setBigBlind} />
          </div>
          <div>
            <label className={label}>Starting stack</label>
            <NumberField min={1} className="field" value={startingStack} onChange={setStartingStack} />
          </div>
          <div>
            <label className={label}>Max seats</label>
            <NumberField min={2} max={8} className="field" value={maxSeats} onChange={setMaxSeats} />
          </div>
        </div>
        <button disabled={busy} className="btn btn-gold mt-2 py-3 text-base">
          {busy ? 'Dealing in…' : 'Deal me in'}
        </button>
      </form>

      <form
        onSubmit={handleJoin}
        className="panel rise-in flex items-end gap-2 rounded-2xl p-6 shadow-2xl"
        style={{ animationDelay: '0.16s' }}
      >
        <div className="flex-1">
          <label className={label}>Join with a code</label>
          <input
            className="field"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="e.g. k7m2pq"
          />
        </div>
        <button className="btn btn-ghost px-5 py-3">Join</button>
      </form>
    </div>
  );
}
