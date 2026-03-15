/**
 * Piece Stats — draft pick rate and win rate per piece, from non-playtest games
 */

import { useState, useEffect } from 'react';
import { PIECE_BY_ID } from '@hyper-fairy-chess/shared';
import { getPieceStats } from '../api/stats';
import type { PieceStat } from '../api/stats';
import './PieceStats.css';

type SortKey = 'name' | 'cost' | 'pickRate' | 'winRate' | 'appearances';
type SortDir = 'asc' | 'desc';

interface EnrichedStat extends PieceStat {
  name: string;
  symbol: string;
  cost: number;
  pickRate: number;   // 0–100
  winRate: number;    // 0–100, wins / (wins + losses), -1 if no decisive games
}

interface PieceStatsProps {
  onClose: () => void;
}

export function PieceStats({ onClose }: PieceStatsProps) {
  const [stats, setStats] = useState<EnrichedStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('pickRate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    getPieceStats()
      .then((raw) => {
        const totalGames = raw[0]?.totalGames ?? 0;
        const totalSlots = totalGames * 2; // one army per player per game

        const enriched: EnrichedStat[] = raw
          .map((s) => {
            const pieceType = PIECE_BY_ID[s.pieceId];
            const decisive = s.wins + s.losses;
            return {
              ...s,
              name: pieceType?.name ?? s.pieceId,
              symbol: pieceType?.symbol ?? '?',
              cost: pieceType?.cost ?? 0,
              pickRate: totalSlots > 0 ? (s.appearances / totalSlots) * 100 : 0,
              winRate: decisive > 0 ? (s.wins / decisive) * 100 : -1,
            };
          });

        setStats(enriched);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load piece stats.');
        setLoading(false);
      });
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = [...stats].sort((a, b) => {
    let av: number, bv: number;
    switch (sortKey) {
      case 'name':       av = a.name.localeCompare(b.name); bv = 0; break;
      case 'cost':       av = a.cost; bv = b.cost; break;
      case 'pickRate':   av = a.pickRate; bv = b.pickRate; break;
      case 'winRate':    av = a.winRate; bv = b.winRate; break;
      case 'appearances': av = a.appearances; bv = b.appearances; break;
      default:           av = 0; bv = 0;
    }
    if (sortKey === 'name') return sortDir === 'asc' ? av : -av;
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const totalGames = stats[0]?.totalGames ?? 0;

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <th className={`sortable ${active ? 'active' : ''}`} onClick={() => handleSort(k)}>
        {label} {active ? (sortDir === 'desc' ? '↓' : '↑') : ''}
      </th>
    );
  }

  function winRateClass(wr: number) {
    if (wr < 0) return '';
    if (wr >= 55) return 'rate-high';
    if (wr <= 45) return 'rate-low';
    return 'rate-mid';
  }

  return (
    <div className="piece-stats-overlay" onClick={onClose}>
      <div className="piece-stats-panel" onClick={e => e.stopPropagation()}>
        <div className="piece-stats-header">
          <h2>Piece Statistics</h2>
          <div className="piece-stats-meta">
            {totalGames > 0
              ? `Based on ${totalGames} non-playtest game${totalGames !== 1 ? 's' : ''}`
              : 'No non-playtest games recorded yet'}
          </div>
          <button className="piece-stats-close" onClick={onClose}>✕</button>
        </div>

        {loading && <div className="piece-stats-loading">Loading…</div>}
        {error && <div className="piece-stats-error">{error}</div>}

        {!loading && !error && stats.length === 0 && (
          <div className="piece-stats-empty">
            No data yet — play some non-playtest games to see piece statistics.
          </div>
        )}

        {!loading && !error && stats.length > 0 && (
          <div className="piece-stats-table-wrap">
            <table className="piece-stats-table">
              <thead>
                <tr>
                  <SortHeader label="Piece" k="name" />
                  <SortHeader label="Cost" k="cost" />
                  <SortHeader label="Pick Rate" k="pickRate" />
                  <SortHeader label="Win Rate" k="winRate" />
                  <SortHeader label="Appearances" k="appearances" />
                  <th>W / D / L</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <tr key={s.pieceId}>
                    <td className="piece-name-cell">
                      <span className="piece-symbol-sm">{s.symbol}</span>
                      {s.name}
                    </td>
                    <td className="num-cell">{s.cost}</td>
                    <td className="num-cell">{s.pickRate.toFixed(1)}%</td>
                    <td className={`num-cell ${winRateClass(s.winRate)}`}>
                      {s.winRate >= 0 ? `${s.winRate.toFixed(1)}%` : '—'}
                    </td>
                    <td className="num-cell">{s.appearances}</td>
                    <td className="num-cell wdl-cell">
                      <span className="wdl-w">{s.wins}</span>
                      {' / '}
                      <span className="wdl-d">{s.draws}</span>
                      {' / '}
                      <span className="wdl-l">{s.losses}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
