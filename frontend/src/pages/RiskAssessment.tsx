import React, { useState } from 'react';
import { Sliders, Send } from 'lucide-react';

export const RiskAssessment: React.FC = () => {
  const [formData, setFormData] = useState({
    transaction_id: 'TX-99901',
    account_id: 'ACC-505',
    amount: 1250000,
    device_id: 'DEV-888',
    session_id: 'SES-102',
  });

  const [result, setResult] = useState<any>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulasi respons backend FastAPI
    setResult({
      transaction_id: formData.transaction_id,
      risk_score: 0.82,
      decision: 'DECLINE',
      model_version: 'aegis-0.1.0',
      latency_ms: 38,
      signals: [
        { name: 'high_amount_anomaly', description: 'Transaction amount significantly exceeds user historical average.' },
        { name: 'velocity_burst', description: 'Multiple attempts in short timeframe.' },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">Interactive Risk Assessment</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">Test New Transaction Payload</h3>
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
          <div>
            <label className="block text-xs text-slate-400 mb-1">Amount (Local Currency)</label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            className="w-flex flex items-center justify-center gap-2 w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2.5 rounded-lg transition-colors mt-4"
          >
            <Send size={16} /> Analyze Transaction
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
                  <span className="font-bold text-rose-400 text-lg">{result.risk_score}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Suggested Decision:</span>
                  <span className="font-bold text-rose-400 px-2 py-0.5 bg-rose-500/10 rounded">{result.decision}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Processing Latency:</span>
                  <span className="font-mono text-cyan-400">{result.latency_ms} ms</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-2">Triggered Signals:</span>
                  <ul className="space-y-2">
                    {result.signals.map((sig: any, idx: number) => (
                      <li key={idx} className="p-2 bg-slate-950 rounded border border-slate-800 text-xs text-slate-300">
                        <strong>{sig.name}:</strong> {sig.description}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic text-center py-20">Submit transaction data to see live risk scoring results.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};