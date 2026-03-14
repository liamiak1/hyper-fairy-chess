/**
 * Games API client - game history and replay data
 */

const getApiBase = (): string => {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `http://${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};

export interface GameSummary {
  id: string;
  whitePlayerName: string;
  blackPlayerName: string;
  resultType: string;
  winnerColor: string | null;
  whiteEloChange: number | null;
  blackEloChange: number | null;
  settings: {
    budget: number;
    boardSize: string;
    placementMode: string;
    draftTimeLimit: number | null;
    moveTimeLimit: number | null;
  } | null;
  moveCount: number;
  playedAt: string;
}

export async function getGames(token: string): Promise<{ success: true; games: GameSummary[] } | { success: false; error: string }> {
  try {
    const res = await fetch(`${getApiBase()}/games`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { success: false, error: 'Failed to load game history' };
    const data = await res.json();
    return { success: true, games: data.games };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

export async function getGameById(gameId: string): Promise<{ success: true; game: unknown } | { success: false; error: string }> {
  try {
    const res = await fetch(`${getApiBase()}/games/${gameId}`);
    if (!res.ok) return { success: false, error: 'Game not found' };
    const data = await res.json();
    return { success: true, game: data.game };
  } catch {
    return { success: false, error: 'Network error' };
  }
}
