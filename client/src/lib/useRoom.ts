import { useEffect, useState } from 'react';
import type { Card, RoomState } from '@poker/shared';
import { socket, serverBase } from './socket';

export interface RoomData {
  state: RoomState | null;
  yourCards: Card[];
  error: string | null;
  connected: boolean;
  dismissError: () => void;
}

/** Subscribes to live room updates from the server. */
export function useRoom(): RoomData {
  const [state, setState] = useState<RoomState | null>(null);
  const [yourCards, setYourCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(socket.connected);

  useEffect(() => {
    const onState = (s: RoomState) => setState(s);
    const onCards = (c: Card[]) => setYourCards(c);
    const onError = (m: string) => setError(m);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('roomState', onState);
    socket.on('yourCards', onCards);
    socket.on('errorMsg', onError);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('roomState', onState);
      socket.off('yourCards', onCards);
      socket.off('errorMsg', onError);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Keep-alive: free hosts (e.g. Render) treat a service as idle when there are no HTTP
  // requests — and a live WebSocket sends none, so they spin the server down mid-game and
  // wipe every table. A periodic /health ping while someone is at a table keeps it awake.
  // (Prod only; in dev the server is on another origin and never sleeps.)
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const ping = () => {
      fetch(`${serverBase}/health`, { cache: 'no-store', keepalive: true }).catch(() => {});
    };
    const id = setInterval(ping, 4 * 60 * 1000); // every 4 min (well under the ~15 min idle cutoff)
    return () => clearInterval(id);
  }, []);

  return { state, yourCards, error, connected, dismissError: () => setError(null) };
}
