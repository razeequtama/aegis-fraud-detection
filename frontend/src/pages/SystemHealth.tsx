import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Database,
  LoaderCircle,
  Server,
  XCircle,
} from 'lucide-react';
import { apiClient } from '../api/client';

interface HealthResponse {
  status: 'healthy' | 'degraded' | string;
  service: string;
  database: {
    status: 'connected' | 'unavailable' | string;
    pool: {
      active_connections: number | null;
      idle_connections: number | null;
      pool_size: number | null;
      overflow_connections: number | null;
      max_connections: number | null;
    };
  };
  inference_engine: {
    status: 'loaded' | 'unavailable' | string;
    model_loaded: boolean;
    model_version: string | null;
  };
  latency: {
    api_p95_ms: number | null;
    api_sample_count: number;
    inference_p95_ms: number | null;
    inference_sample_count: number;
  };
}

const REFRESH_INTERVAL_MS = 10_000;

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    return typeof detail === 'string' ? detail : error.message;
  }
  return error instanceof Error ? error.message : 'Could not load backend health.';
}

function latencyText(value: number | null): string {
  return value === null ? 'Awaiting measurements' : `${value.toFixed(2)} ms`;
}

function StatusIcon({ operational }: { operational: boolean }) {
  return operational ? (
    <CheckCircle2 className="text-emerald-400" size={20} />
  ) : (
    <XCircle className="text-rose-400" size={20} />
  );
}

export const SystemHealth: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchHealth = async () => {
      try {
        const response = await apiClient.get<HealthResponse>('/health', {
          signal: controller.signal,
        });
        setHealth(response.data);
        setErrorMessage(null);
        setLastUpdated(new Date());
      } catch (error) {
        if (!controller.signal.aborted) setErrorMessage(getErrorMessage(error));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void fetchHealth();
    const interval = window.setInterval(() => {
      void fetchHealth();
    }, REFRESH_INTERVAL_MS);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  const serviceOperational = health?.status === 'healthy';
  const databaseConnected = health?.database.status === 'connected';
  const modelLoaded = health?.inference_engine.model_loaded === true;

  const cards = [
    {
      title: 'FastAPI Service',
      Icon: Server,
      operational: serviceOperational,
      status: health
        ? serviceOperational
          ? 'Operational'
          : 'Degraded'
        : 'Unknown',
      metricLabel: 'p95 API Latency',
      metric: health ? latencyText(health.latency.api_p95_ms) : '—',
      detail: health
        ? `${health.latency.api_sample_count} requests measured in the last 5 minutes`
        : 'Live status from the backend health endpoint',
    },
    {
      title: 'PostgreSQL Database',
      Icon: Database,
      operational: databaseConnected,
      status: health
        ? databaseConnected
          ? 'Connected'
          : 'Unavailable'
        : 'Unknown',
      metricLabel: 'Active Connections',
      metric: health
        ? health.database.pool.active_connections === null
          ? 'Not reported'
          : `${health.database.pool.active_connections}${
              health.database.pool.max_connections === null
                ? ''
                : ` / ${health.database.pool.max_connections}`
            }`
        : '—',
      detail: health
        ? `Idle: ${health.database.pool.idle_connections ?? '—'} · Pool size: ${health.database.pool.pool_size ?? '—'}`
        : 'Connection pool usage',
    },
    {
      title: 'ML Inference Engine',
      Icon: Cpu,
      operational: modelLoaded,
      status: health
        ? modelLoaded
          ? 'Loaded'
          : 'Unavailable'
        : 'Unknown',
      metricLabel: 'Artifact Version',
      metric: health?.inference_engine.model_version ?? 'No model loaded',
      detail: health
        ? `Inference p95: ${latencyText(health.latency.inference_p95_ms)} · ${health.latency.inference_sample_count} samples`
        : 'Loaded model artifact and inference latency',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">
            System Health &amp; Observability
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Live backend, database pool, and model inference status.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {loading ? (
            <LoaderCircle className="animate-spin text-cyan-400" size={14} />
          ) : (
            <Activity className="text-cyan-400" size={14} />
          )}
          <span>
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString()} · refreshes every 10s`
              : 'Connecting to backend…'}
          </span>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300"
        >
          <AlertCircle size={19} />
          <span>Unable to refresh system health: {errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(
          ({
            title,
            Icon,
            operational,
            status,
            metricLabel,
            metric,
            detail,
          }) => (
            <section
              key={title}
              className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-slate-300">
                  <Icon size={20} className="text-cyan-400" />
                  <h3 className="text-sm font-semibold">{title}</h3>
                </div>
                <StatusIcon operational={Boolean(operational)} />
              </div>
              <div>
                <p
                  className={`text-xl font-bold ${
                    operational ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {status}
                </p>
                <span className="mt-4 block text-xs text-slate-400">
                  {metricLabel}
                </span>
                <p className="mt-1 break-words text-lg font-semibold text-slate-100">
                  {metric}
                </p>
                <span className="mt-2 block text-xs text-slate-500">{detail}</span>
              </div>
            </section>
          )
        )}
      </div>

      {!health && !errorMessage && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400"
        >
          <LoaderCircle className="animate-spin text-cyan-400" size={17} />
          Loading observability metrics…
        </div>
      )}
    </div>
  );
};
