/**
 * Setup screen - budget selection before draft
 */

import { useState } from 'react';
import { MIN_BUDGET, MAX_BUDGET, BUDGET_STEP, BUDGET_PRESETS } from '../game/rules/draft';
import './SetupScreen.css';

interface SetupScreenProps {
  onStartGame: (budget: number) => void;
}

export function SetupScreen({ onStartGame }: SetupScreenProps) {
  const [budget, setBudget] = useState(400); // Default to "Standard"

  return (
    <div className="setup-screen">
      <h1 className="setup-title">Hyper Fairy Chess</h1>
      <h2 className="setup-subtitle">Game Setup</h2>

      <div className="setup-section">
        <h3>Point Budget</h3>
        <p className="setup-description">
          Each player will draft their army within this budget.
          Higher budgets allow for more powerful pieces.
        </p>

        <div className="budget-presets">
          {BUDGET_PRESETS.map((preset) => (
            <button
              key={preset.value}
              className={`preset-btn ${budget === preset.value ? 'selected' : ''}`}
              onClick={() => setBudget(preset.value)}
            >
              <span className="preset-label">{preset.label}</span>
              <span className="preset-value">{preset.value}</span>
            </button>
          ))}
        </div>

        <div className="budget-slider-container">
          <input
            type="range"
            min={MIN_BUDGET}
            max={MAX_BUDGET}
            step={BUDGET_STEP}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="budget-slider"
          />
          <div className="budget-display">
            <span className="budget-value">{budget}</span>
            <span className="budget-label">points</span>
          </div>
          <button
            className="random-btn"
            onClick={() => {
              const steps = Math.floor((MAX_BUDGET - MIN_BUDGET) / BUDGET_STEP) + 1;
              const randomStep = Math.floor(Math.random() * steps);
              setBudget(MIN_BUDGET + randomStep * BUDGET_STEP);
            }}
            title="Random budget"
          >
            🎲
          </button>
        </div>
      </div>

      <button className="start-btn" onClick={() => onStartGame(budget)}>
        Start Draft
      </button>
    </div>
  );
}
