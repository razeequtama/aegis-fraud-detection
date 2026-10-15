import React, { useEffect, useState } from 'react';
import { Send, Loader2, AlertCircle, Sparkles, Database, Search } from 'lucide-react';
import { isAxiosError } from 'axios';
import { apiClient } from '../api/client';

interface RiskSignal {
  name: string;
  description: string;
}

interface RiskAssessmentResult {
  transaction_id: string;
  risk_score: number;
  decision: string;
  model_version: string;
  signals: RiskSignal[];
  latency_ms: number;
}

interface PresetItem {
  title: string;
  category?: 'APPROVE' | 'REVIEW' | 'DECLINE' | string;
  payload: {
    transaction_id: string;
    account_id: string;
    type: string;
    amount: number;
    oldbalanceOrg: number;
    newbalanceOrig: number;
    oldbalanceDest: number;
    newbalanceDest: number;
    payment_attempts: number;
    device_id?: string;
    session_id?: string;
  };
}

const defaultPresets: PresetItem[] = [
  {
    title: 'Low risk retail payment',
    category: 'APPROVE',
    payload: {
      transaction_id: 'TX-100001',
      account_id: 'C1551703422',
      type: 'PAYMENT',
      amount: 3123.24,
      oldbalanceOrg: 50036.0,
      newbalanceOrig: 46912.76,
      oldbalanceDest: 0,
      newbalanceDest: 0,
      payment_attempts: 1,
      device_id: 'DEV-SIM-946',
      session_id: 'SES-SIM-1',
    },
  },
  {
    title: 'Medium risk cash-out',
    category: 'REVIEW',
    payload: {
      transaction_id: 'TX-100017',
      account_id: 'C640492983',
      type: 'CASH_OUT',
      amount: 36420.6,
      oldbalanceOrg: 11650.0,
      newbalanceOrig: 0,
      oldbalanceDest: 1897757.8,
      newbalanceDest: 1934178.41,
      payment_attempts: 1,
      device_id: 'DEV-SIM-367',
      session_id: 'SES-SIM-17',
    },
  },
  {
    title: 'High risk account drain',
    category: 'DECLINE',
    payload: {
      transaction_id: 'TX-140135',
      account_id: 'C1655503661',
      type: 'CASH_OUT',
      amount: 2988103.3,
      oldbalanceOrg: 2988103.3,
      newbalanceOrig: 0,
      oldbalanceDest: 1402954.55,
      newbalanceDest: 4391057.85,
      payment_attempts: 1,
      device_id: 'DEV-SIM-360',
      session_id: 'SES-SIM-40135',
    },
  },
  {
    title: 'High risk syndicate transfer',
    category: 'DECLINE',
    payload: {
      transaction_id: 'TX-100002',
      account_id: 'C1711670940',
      type: 'TRANSFER',
      amount: 305627.0,
      oldbalanceOrg: 305627.0,
      newbalanceOrig: 0,
      oldbalanceDest: 0,
      newbalanceDest: 0,
      payment_attempts: 1,
      device_id: 'DEV-SIM-807',
      session_id: 'SES-SIM-2',
    },
  },
];

export const RiskAssessment: React.FC = () => {
  const [presets, setPresets] = useState<PresetItem[]>(defaultPresets);
  const [formData, setFormData] = useState({
    transaction_id: 'TX-100001',
    account_id: 'C1551703422',
    amount: 3123.24,
    type: 'PAYMENT',
    oldbalanceOrg: 50036.0,
    newbalanceOrig: 46912.76,
    oldbalanceDest: 0.0,
    newbalanceDest: 0.0,
    device_id: 'DEV-SIM-946',
    session_id: 'SES-SIM-1',
    payment_attempts: 1,
  });

  const [result, setResult] = useState<RiskAssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [lookupId, setLookupId] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiClient
      .get<PresetItem[]>('/risk-assessments/presets')
      .then((res) => {
        if (active && Array.isArray(res.data) && res.data.length > 0) {
          setPresets(res.data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleLookupTransaction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const id = lookupId.trim();
    if (!id) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await apiClient.get<{
        data: {
          transaction: {
            transaction_id: string;
            account_id: string | null;
            amount: number | null;
            type: string | null;
            oldbalance_org?: number | null;
            newbalance_orig?: number | null;
            oldbalance_dest?: number | null;
            newbalance_dest?: number | null;
            payment_attempts?: number | null;
            device_id?: string | null;
            session_id?: string | null;
          };
        };
      }>(`/transactions/${encodeURIComponent(id)}`);
      const tx = res.data.data.transaction;
      setFormData({
        transaction_id: tx.transaction_id,
        account_id: tx.account_id || '',
        amount: Number(tx.amount || 0),
        type: tx.type || 'TRANSFER',
        oldbalanceOrg: Number(tx.oldbalance_org ?? 0),
        newbalanceOrig: Number(tx.newbalance_orig ?? 0),
        oldbalanceDest: Number(tx.oldbalance_dest ?? 0),
        newbalanceDest: Number(tx.newbalance_dest ?? 0),
        device_id: tx.device_id || '',
        session_id: tx.session_id || '',
        payment_attempts: Number(tx.payment_attempts || 1),
      });
      setResult(null);
      setErrorMessage(null);
    } catch (err: unknown) {
      const msg = isAxiosError<{ detail?: string }>(err)
        ? err.response?.data?.detail
        : undefined;
      setLookupError(msg || `Transaction "${id}" not found in database.`);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiClient.post<RiskAssessmentResult>(
        '/risk-assessments',
        formData
      );
      setResult(response.data);
    } catch (error: unknown) {
      console.error('Failed to evaluate risk via backend:', error);
      const backendDetail = isAxiosError<{ detail?: string }>(error)
        ? error.response?.data?.detail
        : undefined;
      setErrorMessage(
        backendDetail || 'Failed to connect to FastAPI backend. Ensure uvicorn is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Interactive Risk Assessment</h2>
        <p className="mt-1 text-sm text-slate-400">
          Run a transaction simulation through the ML model and behavioral pattern engine. Submitted values are evaluated in real time.
        </p>
      </div>
      
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
          <AlertCircle size={20} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-6">
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">Test Transaction Payload</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Transaction ID</label>
              <input
                type="text"
                value={formData.transaction_id}
                onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Account ID</label>
              <input
                type="text"
                value={formData.account_id}
                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Transaction Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="TRANSFER">TRANSFER</option>
                <option value="CASH_OUT">CASH_OUT</option>
                <option value="PAYMENT">PAYMENT</option>
                <option value="DEBIT">DEBIT</option>
                <option value="CASH_IN">CASH_IN</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Amount</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Origin Old Balance</label>
              <input
                type="number"
                value={formData.oldbalanceOrg}
                onChange={(e) => setFormData({ ...formData, oldbalanceOrg: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Origin New Balance</label>
              <input
                type="number"
                value={formData.newbalanceOrig}
                onChange={(e) => setFormData({ ...formData, newbalanceOrig: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Destination Old Balance</label>
              <input
                type="number"
                value={formData.oldbalanceDest}
                onChange={(e) => setFormData({ ...formData, oldbalanceDest: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Destination New Balance</label>
              <input
                type="number"
                value={formData.newbalanceDest}
                onChange={(e) => setFormData({ ...formData, newbalanceDest: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Payment Attempts</label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.payment_attempts}
                onChange={(e) => setFormData({ ...formData, payment_attempts: Math.max(1, Number(e.target.value)) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Device ID</label>
              <input
                type="text"
                value={formData.device_id}
                onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2.5 rounded-lg transition-colors mt-4 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Evaluating Model & Graph...' : 'Run Simulation'}
          </button>
        </form>
        <section className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-cyan-400" />
                <h3 className="text-lg font-semibold text-slate-200">Real Database Presets</h3>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Load verified real transactions from the database directly into the simulation model.
              </p>
            </div>
            <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded">
              Live DB
            </span>
          </div>

          {/* Quick Lookup Bar */}
          <form onSubmit={handleLookupTransaction} className="flex flex-col gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
              <Database size={13} className="text-cyan-400" />
              Load Any Real Transaction from Database
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. TX-100463, TX-140135, TX-100003..."
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
              <button
                type="submit"
                disabled={lookupLoading || !lookupId.trim()}
                className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
              >
                {lookupLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                Load
              </button>
            </div>
            {lookupError && (
              <span className="text-[11px] text-rose-400">{lookupError}</span>
            )}
          </form>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {presets.map(({ title, category, payload }) => (
              <button
                key={payload.transaction_id}
                type="button"
                onClick={() => {
                  setFormData((current) => ({ ...current, ...payload }));
                  setResult(null);
                  setErrorMessage(null);
                }}
                className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-left transition-colors hover:border-cyan-500/40 hover:bg-slate-900 group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="block text-sm font-semibold text-cyan-300 group-hover:underline">{title}</span>
                  {category && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        category === 'DECLINE'
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                          : category === 'REVIEW'
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      }`}
                    >
                      {category}
                    </span>
                  )}
                </div>
                <span className="block text-xs font-mono text-slate-300">
                  {payload.transaction_id} · {payload.type}
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  Amount: {new Intl.NumberFormat('id-ID').format(payload.amount)}
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  Balance: {new Intl.NumberFormat('id-ID').format(payload.oldbalanceOrg)} →{' '}
                  {new Intl.NumberFormat('id-ID').format(payload.newbalanceOrig)}
                </span>
                <span className="mt-1 block text-xs text-slate-500 font-mono">
                  Account: {payload.account_id}
                </span>
                <span className="mt-2 block text-[11px] text-cyan-400 font-medium">
                  Select to load payload →
                </span>
              </button>
            ))}
          </div>
        </section>
        </div>

        {/* Result Panel */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Risk Evaluation Result</h3>
            {result ? (
              <div className="space-y-4 text-sm">
                <div className="flex justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Risk Score:</span>
                  <span className={`font-bold text-lg ${result.risk_score > 0.75 ? 'text-rose-400' : result.risk_score >= 0.4 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {result.risk_score}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Suggested Decision:</span>
                  <span className="font-bold uppercase px-2 py-0.5 rounded text-xs bg-slate-800 text-cyan-400 border border-cyan-500/20">
                    {result.decision}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Model Version:</span>
                  <span className="font-mono text-slate-200">{result.model_version}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block mb-2">Triggered Signals & Graph Metrics:</span>
                  <ul className="space-y-2 max-h-40 overflow-y-auto">
                    {result.signals.map((sig, idx) => (
                      <li key={idx} className="p-2 bg-slate-950 rounded border border-slate-800 text-xs text-slate-300">
                        <strong className="text-cyan-400">{sig.name}:</strong> {sig.description}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic text-center py-20">
                Run a simulation to see the model score, suggested decision, and triggered signals.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};