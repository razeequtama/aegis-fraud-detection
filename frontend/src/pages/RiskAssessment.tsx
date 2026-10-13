import React, { useState } from 'react';
import { Sliders, Send, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../api/client';

export const RiskAssessment: React.FC = () => {
  const [formData, setFormData] = useState({
    transaction_id: 'TX-99901',
    account_id: 'ACC-505',
    amount: 250000.0,
    type: 'TRANSFER',
    oldbalanceOrg: 300000.0,
    newbalanceOrig: 50000.0,
    oldbalanceDest: 0.0,
    newbalanceDest: 250000.0,
    device_id: 'DEV-888',
    session_id: 'SES-102',
  });

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiClient.post('/risk-assessments', formData);
      setResult(response.data);
    } catch (error: any) {
      console.error('Failed to evaluate risk via backend:', error);
      setErrorMessage(
        error.response?.data?.detail || 'Failed to connect to FastAPI backend. Ensure uvicorn is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">Interactive Risk Assessment</h2>
      
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
          <AlertCircle size={20} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form */}
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
              <label className="block text-xs text-slate-400 mb-1">Old Balance Orig</label>
              <input
                type="number"
                value={formData.oldbalanceOrg}
                onChange={(e) => setFormData({ ...formData, oldbalanceOrg: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">New Balance Orig</label>
              <input
                type="number"
                value={formData.newbalanceOrig}
                onChange={(e) => setFormData({ ...formData, newbalanceOrig: Number(e.target.value) })}
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
            {loading ? 'Evaluating Model & Graph...' : 'Analyze Transaction'}
          </button>
        </form>

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
                    {result.signals?.map((sig: any, idx: number) => (
                      <li key={idx} className="p-2 bg-slate-950 rounded border border-slate-800 text-xs text-slate-300">
                        <strong className="text-cyan-400">{sig.name}:</strong> {sig.description}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic text-center py-20">
                Submit transaction data to run live backend inference and graph analysis.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};