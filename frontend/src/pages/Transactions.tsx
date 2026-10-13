import React, { useState } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';

export const Transactions: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');

  // Mock data representing backend transaction query results
  const transactions = [
    { id: 'TX-10021', time: '2026-10-13 12:15', account: 'ACC-105', amount: 'Rp 850,000', riskScore: 0.78, decision: 'REVIEW', type: 'TRANSFER' },
    { id: 'TX-10022', time: '2026-10-13 12:10', account: 'ACC-309', amount: 'Rp 125,000', riskScore: 0.12, decision: 'APPROVE', type: 'PAYMENT' },
    { id: 'TX-10023', time: '2026-10-13 11:55', account: 'ACC-882', amount: 'Rp 2,400,000', riskScore: 0.94, decision: 'DECLINE', type: 'CASH-OUT' },
    { id: 'TX-10024', time: '2026-10-13 11:40', account: 'ACC-112', amount: 'Rp 450,000', riskScore: 0.45, decision: 'REVIEW', type: 'TRANSFER' },
  ];

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'APPROVE': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'REVIEW': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'DECLINE': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-slate-800 text-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100">Transaction Explorer</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search by ID or Account..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 w-64"
            />
          </div>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Decisions</option>
            <option value="APPROVE">Approve</option>
            <option value="REVIEW">Review</option>
            <option value="DECLINE">Decline</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase bg-slate-900/50">
              <th className="p-4">Transaction ID</th>
              <th className="p-4">Timestamp</th>
              <th className="p-4">Account</th>
              <th className="p-4">Type</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Risk Score</th>
              <th className="p-4">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-sm">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-slate-850 transition-colors">
                <td className="p-4 font-medium text-cyan-400">{tx.id}</td>
                <td className="p-4 text-slate-400">{tx.time}</td>
                <td className="p-4 text-slate-300">{tx.account}</td>
                <td className="p-4 text-slate-300">{tx.type}</td>
                <td className="p-4 text-slate-200 font-semibold">{tx.amount}</td>
                <td className="p-4">
                  <span className={`font-bold ${tx.riskScore > 0.7 ? 'text-rose-400' : tx.riskScore > 0.4 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {tx.riskScore}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getDecisionBadge(tx.decision)}`}>
                    {tx.decision}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-sm text-slate-400">
          <span>Showing 1-4 of 15,900 results</span>
          <div className="flex items-center gap-2">
            <button className="p-2 bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50" disabled>
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 py-1 bg-slate-800 rounded text-slate-200">1</span>
            <button className="p-2 bg-slate-800 rounded hover:bg-slate-700">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};