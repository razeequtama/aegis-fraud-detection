import React, { useState } from 'react';
import { ShieldAlert, CheckCircle, XCircle, AlertTriangle, User, Monitor, Clock } from 'lucide-react';

export const Investigation: React.FC = () => {
  const [investigationStatus, setInvestigationStatus] = useState<string | null>(null);

  const handleLabel = (label: string) => {
    setInvestigationStatus(label);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Case Investigation: TX-10021</h2>
          <p className="text-xs text-slate-400 mt-1">Evaluated by Risk Engine v0.1.0 • Triggered 10 mins ago</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleLabel('Confirmed Fraud')}
            className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <XCircle size={16} /> Confirm Fraud
          </button>
          <button
            onClick={() => handleLabel('Legitimate')}
            className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <CheckCircle size={16} /> Mark Legitimate
          </button>
        </div>
      </div>

      {investigationStatus && (
        <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-300 text-sm">
          Success! Analyst feedback recorded as: <strong>{investigationStatus}</strong>. Saved to audit logs.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">Transaction Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400 block">Amount</span>
                <span className="text-xl font-bold text-slate-100">Rp 850,000</span>
              </div>
              <div>
                <span className="text-slate-400 block">Transaction Type</span>
                <span className="font-medium text-slate-200">TRANSFER</span>
              </div>
              <div>
                <span className="text-slate-400 block">Source Account</span>
                <span className="font-medium text-cyan-400">ACC-105 (Balance: Rp 45,000)</span>
              </div>
              <div>
                <span className="text-slate-400 block">Recipient Account</span>
                <span className="font-medium text-slate-200">ACC-992 (Merchants)</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">Risk Signals & Explanations</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                <AlertTriangle className="text-rose-400 mt-0.5" size={18} />
                <div>
                  <h4 className="text-sm font-semibold text-rose-400">Unusual Transaction Velocity</h4>
                  <p className="text-xs text-slate-300 mt-1">Account performed 4 high-value transfers within a 10-minute time window.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="text-amber-400 mt-0.5" size={18} />
                <div>
                  <h4 className="text-sm font-semibold text-amber-400">Shared Device Connection</h4>
                  <p className="text-xs text-slate-300 mt-1">Device DEV-021 is linked to 3 other suspended accounts in the graph network.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">Entity Overview</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-slate-300">
                <User size={18} className="text-cyan-400" />
                <span>Account ID: ACC-105</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <Monitor size={18} className="text-cyan-400" />
                <span>Device ID: DEV-021</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <Clock size={18} className="text-cyan-400" />
                <span>Session ID: SES-991</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};