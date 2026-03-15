/**
 * Stats API client - piece analytics
 */

const getApiBase = (): string => {
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `http://${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};

export interface PieceStat {
  pieceId: string;
  appearances: number;
  totalCopies: number;
  wins: number;
  draws: number;
  losses: number;
  totalGames: number;
}

export async function getPieceStats(): Promise<PieceStat[]> {
  const res = await fetch(`${getApiBase()}/stats/pieces`);
  if (!res.ok) throw new Error('Failed to fetch piece stats');
  return res.json();
}
