import React, { useEffect, useState } from 'react';
import { Send, Loader2, AlertCircle, Sparkles, Database, Search, ShieldCheck, Zap, Activity } from 'lucide-react';
import { isAxiosError } from 'axios';
import { apiClient } from '../api/client';
import { AegisWordmark } from '../components/AegisWordmark';
import { useTranslation } from '../i18n/LanguageContext';

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
  const { t } = useTranslation();
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
      <div className="space-y-1">
        <span className="text-xs sm:text-sm font-mono uppercase tracking-mystic text-cyan-400 font-semibold flex items-center gap-1.5">
          <AegisWordmark size="xs" inline />{t.riskAssessment.tag}
        </span>
        <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-slate-100">
          {t.riskAssessment.title}
        </h2>
        <p className="text-sm sm:text-base text-slate-300 font-normal">
          {t.riskAssessment.subtitle}
        </p>
      </div>
      
      {errorMessage && (
        <div className="animate-slide-down p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
          <AlertCircle size={20} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-6">
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <h3 className="font-display text-base sm:text-lg font-semibold tracking-tight text-slate-200">{t.riskAssessment.testPayload}</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-mono uppercase tracking-wider text-slate-300 mb-1.5">{t.riskAssessment.fieldTxId}</label>
              <input
                type="text"
                value={formData.transaction_id}
                onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-mono uppercase tracking-wider text-slate-300 mb-1.5">{t.riskAssessment.fieldAccountId}</label>
              <input
                type="text"
                value={formData.account_id}
                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-mono uppercase tracking-wider text-slate-300 mb-1.5">{t.riskAssessment.fieldType}</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              >
                <option value="TRANSFER">TRANSFER</option>
                <option value="CASH_OUT">CASH_OUT</option>
                <option value="PAYMENT">PAYMENT</option>
                <option value="DEBIT">DEBIT</option>
                <option value="CASH_IN">CASH_IN</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-mono uppercase tracking-wider text-slate-300 mb-1.5">{t.riskAssessment.fieldAmount}</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-mono uppercase tracking-wider text-slate-300 mb-1.5">{t.riskAssessment.fieldOldOrig}</label>
              <input
                type="number"
                value={formData.oldbalanceOrg}
                onChange={(e) => setFormData({ ...formData, oldbalanceOrg: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-mono uppercase tracking-wider text-slate-300 mb-1.5">{t.riskAssessment.fieldNewOrig}</label>
              <input
                type="number"
                value={formData.newbalanceOrig}
                onChange={(e) => setFormData({ ...formData, newbalanceOrig: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-mono uppercase tracking-wider text-slate-300 mb-1.5">{t.riskAssessment.fieldOldDest}</label>
              <input
                type="number"
                value={formData.oldbalanceDest}
                onChange={(e) => setFormData({ ...formData, oldbalanceDest: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-mono uppercase tracking-wider text-slate-300 mb-1.5">{t.riskAssessment.fieldNewDest}</label>
              <input
                type="number"
                value={formData.newbalanceDest}
                onChange={(e) => setFormData({ ...formData, newbalanceDest: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-mono uppercase tracking-wider text-slate-300 mb-1.5">{t.riskAssessment.fieldAttempts}</label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.payment_attempts}
                onChange={(e) => setFormData({ ...formData, payment_attempts: Math.max(1, Number(e.target.value)) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-mono uppercase tracking-wider text-slate-300 mb-1.5">{t.riskAssessment.fieldDevice}</label>
              <input
                type="text"
                value={formData.device_id}
                onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-2.5 text-sm shadow-lg shadow-cyan-950/40 transition-all active:scale-[0.99] disabled:opacity-50 mt-4"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? t.riskAssessment.evaluatingModel : t.riskAssessment.runSimulationBtn}
          </button>
        </form>
        <section className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-cyan-400" />
                <h3 className="font-display text-base sm:text-lg font-semibold tracking-tight text-slate-200">{t.riskAssessment.realDbPresets}</h3>
              </div>
              <p className="mt-1 text-sm text-slate-300">
                {t.riskAssessment.realDbPresetsDesc}
              </p>
            </div>
            <span className="text-xs sm:text-sm font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded font-medium">
              Live DB
            </span>
          </div>

          {/* Quick Lookup Bar */}
          <form onSubmit={handleLookupTransaction} className="flex flex-col gap-2 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <span className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
              <Database size={14} className="text-cyan-400" />
              {t.riskAssessment.loadAnyRealTx}
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. TX-100463, TX-140135, TX-100003..."
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 font-mono"
              />
              <button
                type="submit"
                disabled={lookupLoading || !lookupId.trim()}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
              >
                {lookupLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                {t.riskAssessment.loadBtn}
              </button>
            </div>
            {lookupError && (
              <span className="text-sm text-rose-400 animate-slide-down">{lookupError}</span>
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
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-left transition-all hover:border-cyan-500/40 hover:bg-slate-900/90 group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="block text-sm font-semibold text-cyan-300 group-hover:underline">{title}</span>
                  {category && (
                    <span
                      className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border ${
                        category === 'DECLINE'
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                          : category === 'REVIEW'
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      }`}
                    >
                      {category === 'DECLINE' ? t.common.decline : category === 'REVIEW' ? t.common.review : t.common.approve}
                    </span>
                  )}
                </div>
                <span className="block text-sm font-mono text-slate-200">
                  {payload.transaction_id} · {payload.type}
                </span>
                <span className="mt-1 block text-sm font-mono text-slate-300">
                  Amount: {new Intl.NumberFormat('id-ID').format(payload.amount)}
                </span>
                <span className="mt-0.5 block text-xs sm:text-sm font-mono text-slate-400">
                  Balance: {new Intl.NumberFormat('id-ID').format(payload.oldbalanceOrg)} → {new Intl.NumberFormat('id-ID').format(payload.newbalanceOrig)}
                </span>
                <span className="mt-0.5 block text-xs sm:text-sm text-slate-400 font-mono">
                  Account: {payload.account_id}
                </span>
                <span className="mt-2 block text-sm text-cyan-400 font-medium group-hover:underline">
                  {t.riskAssessment.selectToLoad}
                </span>
              </button>
            ))}
          </div>
        </section>
        </div>

        {/* Result Panel */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col h-full min-h-[540px] lg:sticky lg:top-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-display text-base sm:text-lg font-semibold tracking-wide text-slate-100">
                {t.riskAssessment.riskEvaluationResult}
              </h3>
              <p className="text-sm text-slate-300 mt-0.5">
                {t.riskAssessment.realTimeInferenceTelemetry}
              </p>
            </div>
            {result && (
              <span className="font-mono text-sm px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-medium">
                {result.transaction_id}
              </span>
            )}
          </div>

          {result ? (
            <div className="flex-1 flex flex-col space-y-5 animate-slide-down">
              {/* Primary Score & Decision Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono uppercase tracking-wider text-slate-300 font-medium">
                      {t.riskAssessment.riskScore}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded uppercase border ${
                        result.risk_score >= 0.75
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                          : result.risk_score >= 0.4
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      }`}
                    >
                      {result.risk_score >= 0.75
                        ? t.riskAssessment.highRisk
                        : result.risk_score >= 0.4
                        ? t.riskAssessment.medRisk
                        : t.riskAssessment.lowRisk}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span
                      className={`font-mono text-3xl font-bold tracking-tight ${
                        result.risk_score >= 0.75
                          ? 'text-rose-400'
                          : result.risk_score >= 0.4
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {typeof result.risk_score === 'number'
                        ? result.risk_score.toFixed(4)
                        : result.risk_score}
                    </span>
                  </div>
                  {/* Gauge bar */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        result.risk_score >= 0.75
                          ? 'bg-rose-500'
                          : result.risk_score >= 0.4
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(0, result.risk_score * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-sm font-mono uppercase tracking-wider text-slate-300 font-medium">
                    {t.riskAssessment.suggestedDecision}
                  </span>
                  <div className="mt-2">
                    <span
                      className={`inline-block font-mono font-bold text-sm tracking-wide uppercase px-3 py-1 rounded-lg border ${
                        result.decision === 'DECLINE'
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                          : result.decision === 'REVIEW'
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      }`}
                    >
                      {result.decision === 'DECLINE' ? t.common.decline : result.decision === 'REVIEW' ? t.common.review : t.common.approve}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs sm:text-sm font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                    <span className="truncate">{result.model_version}</span>
                    {typeof result.latency_ms === 'number' && (
                      <span className="text-cyan-400/90 font-medium shrink-0 ml-2">
                        {result.latency_ms.toFixed(1)} ms
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Triggered Signals & Graph Metrics Window - Expanded & Scrollable */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="text-cyan-400" />
                    <span className="text-sm font-semibold text-slate-200">
                      {t.riskAssessment.triggeredSignals}
                    </span>
                  </div>
                  <span className="font-mono text-xs sm:text-sm px-3 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-700 font-medium">
                    {result.signals.length} {result.signals.length === 1 ? 'Signal' : 'Signals'}
                  </span>
                </div>

                {result.signals.length > 0 ? (
                  <div className="flex-1 min-h-[300px] max-h-[580px] overflow-y-auto space-y-2.5 pr-1.5 scrollbar-thin">
                    {result.signals.map((sig, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700/80 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Zap size={14} className="text-cyan-400 shrink-0" />
                          <strong className="font-mono text-sm font-semibold uppercase tracking-wider text-cyan-300">
                            {sig.name.replace(/_/g, ' ')}
                          </strong>
                        </div>
                        <p className="text-sm text-slate-200 leading-relaxed pl-5">
                          {sig.description}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 rounded-xl border border-slate-800/80 text-center">
                    <ShieldCheck size={36} className="text-emerald-400 mb-2" />
                    <span className="text-sm font-semibold text-slate-200">
                      {t.riskAssessment.noSignalsTriggered}
                    </span>
                    <p className="text-sm text-slate-300 mt-1 max-w-xs">
                      {t.riskAssessment.noSignalsDesc}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
              <div className="p-4 rounded-full bg-slate-950 border border-slate-800 text-slate-500">
                <Activity size={32} className="text-cyan-400/80 animate-pulse" />
              </div>
              <h4 className="font-display font-semibold text-slate-200 text-base">
                {t.riskAssessment.awaitingSimulation}
              </h4>
              <p className="text-sm text-slate-300 max-w-sm leading-relaxed">
                {t.riskAssessment.awaitingSimulationDesc}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};