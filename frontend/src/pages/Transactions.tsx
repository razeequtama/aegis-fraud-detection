import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Sliders, RotateCcw } from 'lucide-react';
import { apiClient } from '../api/client';

interface Transaction {
  id: string;
  time: string;
  account: string;
  type: string;
  amount: string;
  riskScore: number;
  decision: 'APPROVE' | 'REVIEW' | 'DECLINE';
}

interface TransactionResponse {
  data: Transaction[];
}

export const Transactions: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [transferDecision, setTransferDecision] = useState<'ALL' | 'APPROVE' | 'DECLINE'>('ALL');
  const [minRiskScore, setMinRiskScore] = useState<number>(0.0);
  const [maxRiskScore, setMaxRiskScore] = useState<number>(1.0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const fetchTransactions = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await apiClient.get<TransactionResponse>('/transactions', {
          params: {
            page,
            limit: 10,
            search: searchTerm || undefined,
            decision: transferDecision === 'ALL' ? undefined : transferDecision,
            type: transferDecision === 'ALL' ? undefined : 'TRANSFER',
            minRiskScore: minRiskScore > 0 ? minRiskScore : undefined,
            maxRiskScore: maxRiskScore < 1 ? maxRiskScore : undefined,
          },
          signal: controller.signal,
        });
        setTransactions(response.data.data);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to fetch transactions from backend:', error);
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to load transactions.'
          );
          setTransactions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchTransactions();
    return () => controller.abort();
  }, [page, searchTerm, transferDecision, minRiskScore, maxRiskScore]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-fantasy text-2xl sm:text-3xl font-bold tracking-wide text-slate-100">
              Transaction Explorer
            </h2>
          </div>
          <p className="text-sm text-slate-300 mt-1">
            Live fraud evaluation records and real-time inference scores
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <label htmlFor="transfer-decision-filter" className="sr-only">
            Filter transfers by decision
          </label>
          <select
            id="transfer-decision-filter"
            value={transferDecision}
            onChange={(e) => {
              setTransferDecision(e.target.value as 'ALL' | 'APPROVE' | 'DECLINE');
              setPage(1);
            }}
            className="flex-1 sm:flex-initial bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
          >
            <option value="ALL">All decisions</option>
            <option value="DECLINE">Declined only</option>
            <option value="APPROVE">Approved only</option>
          </select>
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-3 text-slate-500" size={17} />
            <input
              type="text"
              placeholder="Search ID or Account..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Risk Score Range Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200 min-w-fit">
            <Sliders size={18} className="text-cyan-400" />
            <span>Risk Score:</span>
            <span
              className={`px-2.5 py-1 rounded text-xs sm:text-sm font-mono font-bold border ${
                minRiskScore >= 0.75
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : minRiskScore >= 0.4
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : maxRiskScore <= 0.4
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
              }`}
            >
              {minRiskScore.toFixed(2)} — {maxRiskScore.toFixed(2)}
            </span>
          </div>

          {/* Dual Sliders and Exact Number Inputs */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-slate-300 font-mono font-medium">Min</span>
              <input
                type="number"
                min="0"
                max={maxRiskScore}
                step="0.05"
                value={minRiskScore}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(Number(e.target.value) || 0, maxRiskScore));
                  setMinRiskScore(Number(val.toFixed(2)));
                  setPage(1);
                }}
                className="w-16 bg-slate-950 border border-slate-750 rounded px-2 py-1 text-sm text-slate-100 font-mono text-center focus:outline-none focus:border-cyan-500 font-semibold"
              />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={minRiskScore}
                onChange={(e) => {
                  const val = Math.min(Number(e.target.value), maxRiskScore);
                  setMinRiskScore(Number(val.toFixed(2)));
                  setPage(1);
                }}
                className="w-20 sm:w-28 accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
              />
            </div>

            <span className="text-slate-600 font-semibold">—</span>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={maxRiskScore}
                onChange={(e) => {
                  const val = Math.max(Number(e.target.value), minRiskScore);
                  setMaxRiskScore(Number(val.toFixed(2)));
                  setPage(1);
                }}
                className="w-20 sm:w-28 accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
              />
              <input
                type="number"
                min={minRiskScore}
                max="1"
                step="0.05"
                value={maxRiskScore}
                onChange={(e) => {
                  const val = Math.min(1, Math.max(Number(e.target.value) || 0, minRiskScore));
                  setMaxRiskScore(Number(val.toFixed(2)));
                  setPage(1);
                }}
                className="w-16 bg-slate-950 border border-slate-750 rounded px-2 py-1 text-sm text-slate-100 font-mono text-center focus:outline-none focus:border-cyan-500 font-semibold"
              />
              <span className="text-xs sm:text-sm text-slate-300 font-mono font-medium">Max</span>
            </div>
          </div>
        </div>

        {/* Quick Range Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => { setMinRiskScore(0.0); setMaxRiskScore(1.0); setPage(1); }}
            className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg border transition-colors ${
              minRiskScore === 0.0 && maxRiskScore === 1.0
                ? 'bg-slate-750 border-slate-600 text-slate-100 font-semibold'
                : 'bg-slate-800/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            All (0-1)
          </button>
          <button
            type="button"
            onClick={() => { setMinRiskScore(0.0); setMaxRiskScore(0.39); setPage(1); }}
            className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg border transition-colors ${
              minRiskScore === 0.0 && maxRiskScore === 0.39
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-semibold'
                : 'bg-slate-800/60 border-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
            }`}
          >
            Low (&lt;0.40)
          </button>
          <button
            type="button"
            onClick={() => { setMinRiskScore(0.40); setMaxRiskScore(0.74); setPage(1); }}
            className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg border transition-colors ${
              minRiskScore === 0.40 && maxRiskScore === 0.74
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold'
                : 'bg-slate-800/60 border-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-800'
            }`}
          >
            Medium (0.40-0.74)
          </button>
          <button
            type="button"
            onClick={() => { setMinRiskScore(0.75); setMaxRiskScore(1.0); setPage(1); }}
            className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg border transition-colors ${
              minRiskScore === 0.75 && maxRiskScore === 1.0
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 font-semibold'
                : 'bg-slate-800/60 border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-800'
            }`}
          >
            High (≥0.75)
          </button>

          {(minRiskScore !== 0.0 || maxRiskScore !== 1.0) && (
            <button
              type="button"
              onClick={() => { setMinRiskScore(0.0); setMaxRiskScore(1.0); setPage(1); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors ml-1 font-medium"
              title="Reset Risk Filter"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading data from PostgreSQL...</div>
        ) : errorMessage ? (
          <div role="alert" className="p-8 text-center text-rose-400">
            Could not load transactions: {errorMessage}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-300 bg-slate-900/70">
                  <th className="p-4 whitespace-nowrap">Transaction ID</th>
                  <th className="p-4 whitespace-nowrap">Timestamp</th>
                  <th className="p-4 whitespace-nowrap">Account</th>
                  <th className="p-4 whitespace-nowrap">Type</th>
                  <th className="p-4 whitespace-nowrap">Amount</th>
                  <th className="p-4 whitespace-nowrap">Risk Score</th>
                  <th className="p-4 whitespace-nowrap">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {transactions.length > 0 ? (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-850 transition-colors">
                      <td className="p-4 font-mono font-medium text-cyan-400 whitespace-nowrap text-sm">
                        <Link
                          to={`/investigation/${encodeURIComponent(tx.id)}`}
                          className="hover:text-cyan-300 hover:underline"
                        >
                          {tx.id}
                        </Link>
                      </td>
                      <td className="p-4 text-slate-300 whitespace-nowrap text-sm">{tx.time}</td>
                      <td className="p-4 text-slate-200 whitespace-nowrap text-sm font-mono">{tx.account}</td>
                      <td className="p-4 text-slate-200 whitespace-nowrap text-sm font-medium">{tx.type}</td>
                      <td className="p-4 text-slate-100 font-semibold whitespace-nowrap text-sm">{tx.amount}</td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold font-mono text-sm ${tx.riskScore >= 0.75 ? 'text-rose-400' : tx.riskScore >= 0.4 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {typeof tx.riskScore === 'number' ? tx.riskScore.toFixed(2) : tx.riskScore}
                          </span>
                          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className={`h-full ${tx.riskScore >= 0.75 ? 'bg-rose-500' : tx.riskScore >= 0.4 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(100, Math.max(0, tx.riskScore * 100))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getDecisionBadge(tx.decision)}`}>
                          {tx.decision}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 text-sm">No transactions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-sm text-slate-300">
          <span>Page {page}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="p-2 bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50"
              disabled={page === 1}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 py-1 bg-slate-800 rounded text-slate-200">{page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              className="p-2 bg-slate-800 rounded hover:bg-slate-700"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};