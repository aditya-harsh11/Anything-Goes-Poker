export interface Session {
  playerId: string;
  token: string;
}

const key = (roomId: string) => `poker:session:${roomId.toLowerCase()}`;

export function saveSession(roomId: string, session: Session): void {
  localStorage.setItem(key(roomId), JSON.stringify(session));
}

export function loadSession(roomId: string): Session | null {
  const raw = localStorage.getItem(key(roomId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession(roomId: string): void {
  localStorage.removeItem(key(roomId));
}
