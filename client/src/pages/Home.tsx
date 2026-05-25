import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoomSettings } from '@poker/shared';
import { createRoom } from '../lib/api';
import { saveSession } from '../lib/session';

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [smallBlind, setSmallBlind] = useState(5);
  const [bigBlind, setBigBlind] = useState(10);
  const [startingStack, setStartingStack] = useState(1000);
  const [maxSeats, setMaxSeats] = useState(8);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const settings: RoomSettings = {
      variant: 'texas', // starting variant; the host changes it per hand at the table
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

  const field = 'w-full rounded-lg bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500';
  const label = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400';

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 p-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-emerald-400">♠ Card Room</h1>
        <p className="mt-1 text-sm text-slate-400">Texas Hold'em for your home game — play-chip only.</p>
      </header>

      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-2xl bg-slate-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Create a game</h2>
        <div>
          <label className={label}>Your name</label>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Host" />
        </div>
        <p className="text-xs text-slate-500">You'll choose the variant for each hand at the table.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Small blind</label>
            <input
              type="number"
              min={1}
              className={field}
              value={smallBlind}
              onChange={(e) => setSmallBlind(Number(e.target.value))}
            />
          </div>
          <div>
            <label className={label}>Big blind</label>
            <input
              type="number"
              min={1}
              className={field}
              value={bigBlind}
              onChange={(e) => setBigBlind(Number(e.target.value))}
            />
          </div>
          <div>
            <label className={label}>Starting stack</label>
            <input
              type="number"
              min={1}
              className={field}
              value={startingStack}
              onChange={(e) => setStartingStack(Number(e.target.value))}
            />
          </div>
          <div>
            <label className={label}>Max seats</label>
            <input
              type="number"
              min={2}
              max={8}
              className={field}
              value={maxSeats}
              onChange={(e) => setMaxSeats(Number(e.target.value))}
            />
          </div>
        </div>
        <button
          disabled={busy}
          className="mt-2 rounded-lg bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create game'}
        </button>
      </form>

      <form onSubmit={handleJoin} className="flex items-end gap-2 rounded-2xl bg-slate-900 p-6 shadow-xl">
        <div className="flex-1">
          <label className={label}>Join with a code</label>
          <input
            className={field}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="e.g. k7m2pq"
          />
        </div>
        <button className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-500">
          Join
        </button>
      </form>
    </div>
  );
}
