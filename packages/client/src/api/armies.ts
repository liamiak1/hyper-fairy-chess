/**
 * Armies API client for saved armies CRUD operations
 */

// Get the server URL from environment or default to localhost
const getApiBase = (): string => {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `http://${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};

export interface ArmyPiece {
  pieceTypeId: string;
  count: number;
}

export interface SavedArmy {
  id: string;
  userId: string;
  name: string;
  pieces: ArmyPiece[];
  budget: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArmyError {
  error: string;
  message: string;
}

/**
 * Get all saved armies for the current user
 */
export async function getArmies(
  token: string
): Promise<{ success: true; armies: SavedArmy[] } | { success: false; error: string }> {
  try {
    const response = await fetch(`${getApiBase()}/armies`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.message || 'Failed to fetch armies' };
    }

    const data = await response.json();
    return { success: true, armies: data.armies };
  } catch {
    return { success: false, error: 'Failed to connect to server' };
  }
}

/**
 * Create a new saved army
 */
export async function createArmy(
  token: string,
  name: string,
  pieces: ArmyPiece[],
  budget: number
): Promise<{ success: true; army: SavedArmy } | { success: false; error: string }> {
  try {
    const response = await fetch(`${getApiBase()}/armies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, pieces, budget }),
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.message || 'Failed to create army' };
    }

    const data = await response.json();
    return { success: true, army: data.army };
  } catch {
    return { success: false, error: 'Failed to connect to server' };
  }
}

/**
 * Update an existing army
 */
export async function updateArmy(
  token: string,
  armyId: string,
  name: string,
  pieces: ArmyPiece[],
  budget: number
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const response = await fetch(`${getApiBase()}/armies/${armyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, pieces, budget }),
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.message || 'Failed to update army' };
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to connect to server' };
  }
}

/**
 * Delete an army
 */
export async function deleteArmy(
  token: string,
  armyId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const response = await fetch(`${getApiBase()}/armies/${armyId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.message || 'Failed to delete army' };
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to connect to server' };
  }
}
