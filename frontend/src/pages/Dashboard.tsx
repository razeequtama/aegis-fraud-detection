import React from 'react';
import { ShieldAlert, TrendingUp, Users, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const mockData = [
  { time: '00:00', transactions: 1200, fraud: 12 },
  { time: '04:00', transactions: 800, fraud: 8 },
  { time: '08:00', transactions: 3400, fraud: 45 },
  { time: '12:00', transactions: 4500, fraud: 62 },
  { time: '16:00', transactions: 3900, fraud: 38 },
  { time: '20:00', transactions: 2100, fraud: 20 },
];

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">Command Center</h2>
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm font-medium">Total Processed (24h)</span>
            <TrendingUp size={20} className="text-cyan-400" />
          </div>
          <p className="text-3xl font-bold text-slate-100 mt-4">15,900</p>
          <span className="text-xs text-emerald-400 mt-2 inline-block">+4.2% from yesterday</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm font-medium">Review Queue</span>
            <ShieldAlert size={20} className="text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-slate-100 mt-4">185</p>
          <span className="text-xs text-amber-400 mt-2 inline-block">Requires analyst attention</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm font-medium">Detected Frauds</span>
            <Users size={20} className="text-rose-400" />
          </div>
          <p className="text-3xl font-bold text-slate-100 mt-4">185</p>
          <span className="text-xs text-rose-400 mt-2 inline-block">1.16% fraud rate</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm font-medium">Model Status</span>
            <CheckCircle2 size={20} className="text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-emerald-400 mt-4">v0.1.0-prod</p>
          <span className="text-xs text-slate-400 mt-2 inline-block">Last evaluated 2h ago</span>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Transaction & Suspicious Activity Trend</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockData}>
              <XAxis dataKey="time" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="transactions" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.1} />
              <Area type="monotone" dataKey="fraud" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};