import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle2, Cpu, LoaderCircle, Play } from 'lucide-react';
import { apiClient } from '../api/client';

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
}

interface ReplayCreated {
  job_id?: number;
  replay_id?: number;
  status: string;
}

const modelVersions = [
  'aegis-v0.1.0-randomforest',
  'aegis-v0.0.8-baseline',
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
  const [threshold, setThreshold] = useState(0.75);
  const [modelVersion, setModelVersion] = useState(modelVersions[0]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [replay, setReplay] = useState<ReplayStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    []
  );

  const handleRunReplay = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsSimulating(true);
    setError(null);
    setReplay(null);

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
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Model Lab &amp; Replay Simulator</h2>
        <p className="mt-1 text-sm text-slate-400">
          Evaluate model decision thresholds against historical transactions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-2">
            <Cpu className="text-cyan-400" size={18} />
            <h3 className="text-lg font-semibold text-slate-200">Replay Configuration</h3>
          </div>

          <div>
            <label htmlFor="model-version" className="mb-1 block text-xs text-slate-400">
              Model Version
            </label>
            <select
              id="model-version"
              value={modelVersion}
              onChange={(event) => setModelVersion(event.target.value)}
              disabled={isSimulating}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none disabled:opacity-60"
            >
              {modelVersions.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="decision-threshold" className="mb-2 flex justify-between text-xs text-slate-400">
              <span>Decision Threshold</span>
              <span className="font-mono text-cyan-300">{threshold.toFixed(2)}</span>
            </label>
            <input
              id="decision-threshold"
              type="range"
              min="0.1"
              max="0.99"
              step="0.01"
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
              disabled={isSimulating}
              className="w-full accent-cyan-500 disabled:opacity-60"
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
              <span>0.10</span>
              <span>0.99</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleRunReplay()}
            disabled={isSimulating}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2.5 font-semibold text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSimulating ? (
              <>
                <LoaderCircle className="animate-spin" size={17} />
                {replay?.status === 'RUNNING' ? 'Simulating…' : 'Starting replay…'}
              </>
            ) : (
              <>
                <Play size={16} />
                Run Historical Replay
              </>
            )}
          </button>
        </section>

        <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6 md:col-span-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-200">Simulation Impact Analysis</h3>
            <p className="mt-1 text-xs text-slate-400">
              Comparison uses the baseline policy threshold of 0.75.
            </p>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
              <AlertTriangle className="mt-0.5 shrink-0" size={17} />
              <span>{error}</span>
            </div>
          )}

          {isSimulating && (
            <div role="status" className="flex items-center gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-cyan-200">
              <LoaderCircle className="animate-spin text-cyan-400" size={18} />
              <div>
                <p className="font-medium">
                  {replay?.status === 'RUNNING' ? 'Replay simulation is running' : 'Replay job is queued'}
                </p>
                {replay && <p className="mt-1 text-xs text-slate-400">Job #{replay.replay_id}</p>}
              </div>
            </div>
          )}

          {!metrics && !isSimulating && !error && (
            <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
              Run a replay to see its operational impact metrics.
            </div>
          )}

          {metrics && (
            <>
              <div role="status" className="flex items-center gap-2 text-sm text-emerald-300">
                <CheckCircle2 size={17} />
                Replay completed for {replay.model_version} at threshold {replay.threshold.toFixed(2)}.
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <span className="block text-xs text-slate-400">Review Queue Load</span>
                  <span className="mt-2 inline-block text-2xl font-bold text-slate-100">
                    {formatCount(metrics.review_count)} <span className="text-sm font-medium text-slate-400">transactions</span>
                  </span>
                  <span className={`mt-1 block text-xs ${reviewDifferenceClass}`}>
                    {reviewDifference > 0 ? '+' : ''}
                    {formatCount(reviewDifference)} vs baseline
                    {metrics.review_queue_difference_percent !== null
                      ? ` (${metrics.review_queue_difference_percent > 0 ? '+' : ''}${metrics.review_queue_difference_percent.toFixed(1)}%)`
                      : ''}
                  </span>
                  <span className="mt-1 block text-[11px] text-slate-500">
                    Baseline: {formatCount(metrics.baseline_review_count)}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <span className="block text-xs text-slate-400">Fraud Captured</span>
                  <span className="mt-2 inline-block text-2xl font-bold text-emerald-400">
                    {formatCount(metrics.fraud_detected)} <span className="text-sm font-medium text-slate-400">cases</span>
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Of {formatCount(metrics.total_processed)} transactions replayed
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:col-span-2">
                  <span className="block text-xs text-slate-400">False Positive Metrics</span>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                    <span className="text-2xl font-bold text-rose-300">
                      {formatCount(metrics.false_positives)}
                    </span>
                    <span className="text-sm text-slate-300">
                      false positives · {(metrics.false_positive_rate * 100).toFixed(2)}% false-positive rate
                    </span>
                  </div>
                  <span className="mt-1 block text-[11px] text-slate-500">
                    Rate is false positives as a share of legitimate historical transactions.
                  </span>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};
