import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
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
  }, [page, searchTerm, transferDecision]);

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
        <h2 className="text-2xl font-bold text-slate-100">Transaction Explorer (Live DB)</h2>
        <div className="flex items-center gap-3">
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
            className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All transactions</option>
            <option value="DECLINE">Declined transfers only</option>
            <option value="APPROVE">Approved transfers only</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search by ID or Account..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 w-64"
            />
          </div>
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
              {transactions.length > 0 ? (
                transactions.map((tx) => (
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
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-sm text-slate-400">
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