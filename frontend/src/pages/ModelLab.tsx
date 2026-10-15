import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  History,
  LoaderCircle,
  Play,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { AegisWordmark } from '../components/AegisWordmark';
import { useTranslation } from '../i18n/LanguageContext';

interface ReplayMetrics {
  total_processed: number;
  review_count: number;
  baseline_review_count: number;
  review_queue_difference: number;
  review_queue_difference_percent: number | null;
  baseline_threshold: number;
  fraud_detected: number;
  false_positives: number;
  false_positive_rate: number;
}

interface ReplayStatus {
  job_id?: number;
  replay_id: number;
  model_version: string;
  threshold: number;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;
  metrics_summary: ReplayMetrics | null;
  error_message: string | null;
  created_at?: string | null;
}

interface ReplayCreated {
  job_id?: number;
  replay_id?: number;
  status: string;
}

interface ModelOption {
  id: string;
  label: string;
  badge: string;
  description: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'aegis-rf-0.1.0',
    label: 'aegis-rf-0.1.0 (Active Live)',
    badge: 'Production',
    description: 'Trained Random Forest (100 estimators, scaled features)',
  },
  {
    id: 'aegis-rf-0.0.8-baseline',
    label: 'aegis-rf-0.0.8 (Baseline Heuristic)',
    badge: 'Baseline',
    description: 'Rule-based benchmark for legacy comparison',
  },
];

const THRESHOLD_PRESETS = [
  { label: '0.40 (Sensitive)', value: 0.40 },
  { label: '0.60 (Balanced)', value: 0.60 },
  { label: '0.75 (Standard Live)', value: 0.75 },
  { label: '0.85 (Conservative)', value: 0.85 },
  { label: '0.95 (High Friction)', value: 0.95 },
];

const pollIntervalMs = 1000;

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    return typeof detail === 'string' ? detail : error.message;
  }
  return error instanceof Error ? error.message : 'Unable to run historical replay.';
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function waitForPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Replay polling was cancelled.', 'AbortError'));
      return;
    }
    const timeout = window.setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, pollIntervalMs);
    const abort = () => {
      window.clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      reject(new DOMException('Replay polling was cancelled.', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

export const ModelLab: React.FC = () => {
  const { t } = useTranslation();
  const [threshold, setThreshold] = useState(0.75);
  const [modelVersion, setModelVersion] = useState(MODEL_OPTIONS[0].id);
  const [isSimulating, setIsSimulating] = useState(false);
  const [replay, setReplay] = useState<ReplayStatus | null>(null);
  const [recentReplays, setRecentReplays] = useState<ReplayStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // Fetch recent replays from database
  const loadRecentReplays = useCallback(async () => {
    try {
      const res = await apiClient.get<ReplayStatus[]>('/replays');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setRecentReplays(res.data);
        // If no replay selected yet, auto-select the latest completed run
        const latestCompleted = res.data.find((r) => r.status === 'COMPLETED' && r.metrics_summary);
        if (latestCompleted) {
          setReplay((prev) => prev ?? latestCompleted);
        }
      }
    } catch {
      // Replays endpoint might be empty initially, graceful fail
    }
  }, []);

  useEffect(() => {
    void loadRecentReplays();
    return () => {
      controllerRef.current?.abort();
    };
  }, [loadRecentReplays]);

  const handleRunReplay = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsSimulating(true);
    setError(null);

    try {
      const created = await apiClient.post<ReplayCreated>(
        '/replays',
        { model_version: modelVersion, threshold },
        { signal: controller.signal }
      );
      const jobId = created.data.job_id ?? created.data.replay_id;
      if (jobId === undefined || jobId === null) {
        throw new Error('The replay API did not return a job ID.');
      }

      while (!controller.signal.aborted) {
        const statusResponse = await apiClient.get<ReplayStatus>(
          `/replays/${encodeURIComponent(String(jobId))}`,
          { signal: controller.signal }
        );
        const currentReplay = statusResponse.data;
        setReplay(currentReplay);

        if (currentReplay.status === 'COMPLETED') {
          if (!currentReplay.metrics_summary) {
            throw new Error('Replay completed without returning comparison metrics.');
          }
          void loadRecentReplays();
          break;
        }
        if (currentReplay.status === 'FAILED') {
          throw new Error(currentReplay.error_message || 'The replay worker failed.');
        }
        await waitForPoll(controller.signal);
      }
    } catch (requestError) {
      if (!controller.signal.aborted) setError(errorMessage(requestError));
    } finally {
      if (!controller.signal.aborted) {
        setIsSimulating(false);
        controllerRef.current = null;
      }
    }
  };

  const metrics = replay?.status === 'COMPLETED' ? replay.metrics_summary : null;
  const reviewDifference = metrics?.review_queue_difference ?? 0;
  const reviewDifferenceClass =
    reviewDifference > 0
      ? 'text-amber-300'
      : reviewDifference < 0
        ? 'text-emerald-300'
        : 'text-slate-300';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-mystic text-cyan-400 font-semibold flex items-center gap-1.5">
            <AegisWordmark size="xs" inline /> // {t.modelLab.tag}
          </span>
          <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-slate-100 mt-1">
            {t.modelLab.title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            {t.modelLab.subtitle}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Configuration Panel */}
        <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Cpu className="text-cyan-400" size={18} />
            <h3 className="font-display text-base font-semibold tracking-tight text-slate-200">
              {t.modelLab.configTitle}
            </h3>
          </div>

          <div>
            <label htmlFor="model-version" className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-slate-400">
              {t.modelLab.modelSelect}
            </label>
            <select
              id="model-version"
              value={modelVersion}
              onChange={(event) => setModelVersion(event.target.value)}
              disabled={isSimulating}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none disabled:opacity-60 interactive-input"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 flex justify-between items-center text-xs font-mono">
              <span className="text-slate-400 uppercase tracking-wider">{t.modelLab.thresholdSelect}</span>
              <span className="text-cyan-300 font-bold text-sm bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded">
                {threshold.toFixed(2)}
              </span>
            </div>
            <input
              id="decision-threshold"
              type="range"
              min="0.10"
              max="0.99"
              step="0.01"
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
              disabled={isSimulating}
              className="w-full accent-cyan-500 disabled:opacity-60 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-500 font-mono">
              <span>0.10 (Sensitive)</span>
              <span>0.75 (Live)</span>
              <span>0.99 (Strict)</span>
            </div>
          </div>

          {/* Quick presets */}
          <div>
            <span className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Sliders size={13} className="text-cyan-400" /> {t.modelLab.quickThresholdPresets}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {THRESHOLD_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setThreshold(p.value)}
                  disabled={isSimulating}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-mono transition-all ${
                    Math.abs(threshold - p.value) < 0.005
                      ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200 font-semibold shadow-sm shadow-cyan-950'
                      : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleRunReplay()}
            disabled={isSimulating}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-2.5 text-sm shadow-lg shadow-cyan-950/40 transition-all disabled:cursor-not-allowed disabled:opacity-60 interactive-btn"
          >
            {isSimulating ? (
              <>
                <LoaderCircle className="animate-spin" size={17} />
                {replay?.status === 'RUNNING' ? t.modelLab.runningBatch : t.modelLab.queuingJob}
              </>
            ) : (
              <>
                <Play size={16} />
                {t.modelLab.runReplay}
              </>
            )}
          </button>
        </section>

        {/* Impact Analysis Results */}
        <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="font-display text-base font-semibold tracking-tight text-slate-200">
                {t.modelLab.summaryTitle}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {t.modelLab.impactSubtitle}
              </p>
            </div>
            {replay && (
              <span className="rounded-full bg-slate-800 border border-slate-700/60 px-2.5 py-0.5 text-xs font-mono text-cyan-300">
                Job #{replay.replay_id}
              </span>
            )}
          </div>

          {error && (
            <div role="alert" className="animate-slide-down flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
              <AlertTriangle className="mt-0.5 shrink-0 text-rose-400" size={17} />
              <span>{error}</span>
            </div>
          )}

          {isSimulating && (
            <div role="status" className="animate-fade-in flex items-center gap-3.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-cyan-200">
              <LoaderCircle className="animate-spin text-cyan-400" size={20} />
              <div>
                <p className="font-semibold text-slate-100">
                  {replay?.status === 'RUNNING' ? 'Simulating Historical Transactions…' : 'Replay Job Queued'}
                </p>
                <p className="mt-0.5 text-xs text-slate-400 font-mono">
                  Vectorizing features and running Random Forest inference against 50,000 ledger records
                </p>
              </div>
            </div>
          )}

          {!metrics && !isSimulating && !error && (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
              <Sparkles className="mx-auto mb-2 text-cyan-400" size={24} />
              <p className="font-medium text-slate-300">{t.modelLab.noReplayLoaded}</p>
              <p className="text-xs text-slate-500 mt-1">
                {t.modelLab.clickToRun}
              </p>
            </div>
          )}

          {metrics && (
            <div className="space-y-4 animate-slide-down">
              <div role="status" className="flex items-center gap-2 text-xs sm:text-sm text-emerald-300 font-medium bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>
                  Replay completed for <strong className="font-mono text-emerald-200">{replay?.model_version}</strong> at threshold <strong className="font-mono text-emerald-200">{(replay?.threshold ?? 0).toFixed(2)}</strong>.
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="interactive-card rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <span className="block text-xs font-mono uppercase tracking-wider text-slate-400">{t.modelLab.reviewQueueLoad}</span>
                  <span className="mt-2 inline-block text-2xl font-bold font-mono text-slate-100">
                    {formatCount(metrics.review_count)} <span className="text-xs font-sans text-slate-400 font-normal">{t.modelLab.transactions}</span>
                  </span>
                  <span className={`mt-1 block text-xs font-medium font-mono ${reviewDifferenceClass}`}>
                    {reviewDifference > 0 ? '+' : ''}
                    {formatCount(reviewDifference)} {t.modelLab.vsBaseline}
                    {metrics.review_queue_difference_percent !== null
                      ? ` (${metrics.review_queue_difference_percent > 0 ? '+' : ''}${metrics.review_queue_difference_percent.toFixed(1)}%)`
                      : ''}
                  </span>
                  <span className="mt-1 block text-[11px] text-slate-500 font-mono">
                    Baseline (0.75): {formatCount(metrics.baseline_review_count)}
                  </span>
                </div>

                <div className="interactive-card rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <span className="block text-xs font-mono uppercase tracking-wider text-slate-400">{t.modelLab.fraudCasesCaptured}</span>
                  <span className="mt-2 inline-block text-2xl font-bold font-mono text-emerald-400">
                    {formatCount(metrics.fraud_detected)} <span className="text-xs font-sans text-slate-400 font-normal">{t.modelLab.cases}</span>
                  </span>
                  <span className="mt-1 block text-xs text-slate-400 font-mono">
                    Of {formatCount(metrics.total_processed)} {t.modelLab.transactions} replayed
                  </span>
                </div>

                <div className="interactive-card rounded-xl border border-slate-800 bg-slate-950 p-4 sm:col-span-2">
                  <span className="block text-xs font-mono uppercase tracking-wider text-slate-400">{t.modelLab.falsePositiveRatio}</span>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                    <span className="text-2xl font-bold font-mono text-rose-300">
                      {formatCount(metrics.false_positives)}
                    </span>
                    <span className="text-xs text-slate-300 font-mono">
                      false positive alerts · {(metrics.false_positive_rate * 100).toFixed(3)}% FP rate
                    </span>
                  </div>
                  <span className="mt-1 block text-[11px] text-slate-500">
                    {t.modelLab.rateExplainer}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Historical Benchmarking Log */}
      {recentReplays.length > 0 && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <History size={16} className="text-cyan-400" />
              <h3 className="font-display text-base font-semibold text-slate-200">
                {t.modelLab.recentRuns}
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {recentReplays.length} benchmark(s) logged
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="pb-2 font-medium">{t.modelLab.thRunId}</th>
                  <th className="pb-2 font-medium">{t.modelLab.thModel}</th>
                  <th className="pb-2 font-medium">{t.modelLab.thThreshold}</th>
                  <th className="pb-2 font-medium">{t.modelLab.thReviewCount}</th>
                  <th className="pb-2 font-medium">{t.modelLab.thFraudCaught}</th>
                  <th className="pb-2 font-medium">{t.modelLab.thFpRate}</th>
                  <th className="pb-2 font-medium text-right">{t.modelLab.thAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {recentReplays.map((r) => {
                  const m = r.metrics_summary;
                  const isCurrent = replay?.replay_id === r.replay_id;
                  return (
                    <tr key={r.replay_id} className={`hover:bg-slate-800/40 ${isCurrent ? 'bg-cyan-500/5' : ''}`}>
                      <td className="py-2.5 font-semibold text-slate-100">
                        #{r.replay_id}
                        {isCurrent && (
                          <span className="ml-1.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 px-1 py-0.2 text-[10px]">
                            {t.modelLab.activeBadge}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-slate-300">{r.model_version}</td>
                      <td className="py-2.5 text-cyan-300 font-bold">{r.threshold.toFixed(2)}</td>
                      <td className="py-2.5">
                        {m ? formatCount(m.review_count) : '—'}
                      </td>
                      <td className="py-2.5 text-emerald-400">
                        {m ? formatCount(m.fraud_detected) : '—'}
                      </td>
                      <td className="py-2.5 text-slate-300">
                        {m ? `${(m.false_positive_rate * 100).toFixed(3)}%` : '—'}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setReplay(r);
                            setThreshold(r.threshold);
                            setModelVersion(r.model_version);
                          }}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-200 hover:border-cyan-500 hover:text-cyan-300 transition-colors"
                        >
                          {t.modelLab.loadMetrics}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
