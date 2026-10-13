import React, { useState } from 'react';
import { Cpu, Play } from 'lucide-react';

export const ModelLab: React.FC = () => {
  const [threshold, setThreshold] = useState(0.75);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleRunReplay = () => {
    setIsSimulating(true);
    setTimeout(() => setIsSimulating(false), 1500);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">Model Lab & Replay Simulator</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">Replay Configuration</h3>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Model Version</label>
            <select className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100">
              <option>aegis-v0.1.0-randomforest</option>
              <option>aegis-v0.0.8-baseline</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Decision Threshold: {threshold}</label>
            <input
              type="range"
              min="0.1"
              max="0.99"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-cyan-500"
            />
          </div>
          <button
            onClick={handleRunReplay}
            disabled={isSimulating}
            className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2.5 rounded-lg transition-colors mt-4 disabled:opacity-50"
          >
            <Play size={16} /> {isSimulating ? 'Running Simulation...' : 'Run Historical Replay'}
          </button>
        </div>

        {/* Results Simulation Comparison */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">Simulation Impact Analysis</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block">Review Queue Load</span>
              <span className="text-2xl font-bold text-amber-400 mt-2 inline-block">2,410 txs</span>
              <span className="text-xs text-slate-500 block mt-1">+12% compared to old policy</span>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block">Fraud Captured</span>
              <span className="text-2xl font-bold text-emerald-400 mt-2 inline-block">792 cases</span>
              <span className="text-xs text-emerald-500 block mt-1">+42 more frauds caught</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};