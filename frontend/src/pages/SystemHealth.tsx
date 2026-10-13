import React from 'react';
import { Activity, CheckCircle2, Server, Database, Cpu } from 'lucide-react';

export const SystemHealth: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">System Health & Observability</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm font-medium">FastAPI Service</span>
            <Server size={20} className="text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-emerald-400">Operational</p>
          <span className="text-xs text-slate-400 block">p95 Latency: 34ms</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm font-medium">PostgreSQL Database</span>
            <Database size={20} className="text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-emerald-400">Connected</p>
          <span className="text-xs text-slate-400 block">Active Pools: 12 / 20</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm font-medium">ML Inference Engine</span>
            <Cpu size={20} className="text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-emerald-400">Loaded (v0.1.0)</p>
          <span className="text-xs text-slate-400 block">Error Rate: 0.00%</span>
        </div>
      </div>
    </div>
  );
};