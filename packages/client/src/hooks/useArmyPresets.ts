/**
 * Army Presets Hook
 * Manages saved army configurations in localStorage
 */

import { useState, useCallback, useEffect } from 'react';
import type { BoardSize, DraftSelection } from '@hyper-fairy-chess/shared';

export interface ArmyPreset {
  id: string;
  name: string;
  selections: DraftSelection[];
  budgetUsed: number;
  targetBudget: number;
  boardSize: BoardSize;
  createdAt: number;
}

const STORAGE_KEY = 'hfc_army_presets';

function generateId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function loadPresets(): ArmyPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function savePresets(presets: ArmyPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.error('Failed to save army presets:', e);
  }
}

export function useArmyPresets() {
  const [presets, setPresets] = useState<ArmyPreset[]>(() => loadPresets());

  // Persist changes
  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  const addPreset = useCallback((
    name: string,
    selections: DraftSelection[],
    budgetUsed: number,
    targetBudget: number,
    boardSize: BoardSize
  ): ArmyPreset => {
    const newPreset: ArmyPreset = {
      id: generateId(),
      name: name.trim() || 'Unnamed Army',
      selections,
      budgetUsed,
      targetBudget,
      boardSize,
      createdAt: Date.now(),
    };

    setPresets(current => [...current, newPreset]);
    return newPreset;
  }, []);

  const removePreset = useCallback((id: string): void => {
    setPresets(current => current.filter(p => p.id !== id));
  }, []);

  const renamePreset = useCallback((id: string, newName: string): void => {
    setPresets(current =>
      current.map(p => (p.id === id ? { ...p, name: newName.trim() || 'Unnamed Army' } : p))
    );
  }, []);

  const getPresetsForSettings = useCallback((boardSize: BoardSize, budget: number): ArmyPreset[] => {
    // Return presets that match the board size and fit within budget
    return presets.filter(
      p => p.boardSize === boardSize && p.budgetUsed <= budget
    );
  }, [presets]);

  return {
    presets,
    addPreset,
    removePreset,
    renamePreset,
    getPresetsForSettings,
  };
}
