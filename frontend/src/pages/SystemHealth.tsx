import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Database,
  LoaderCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  XCircle,
  Zap,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { AegisWordmark } from '../components/AegisWordmark';

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
  redis?: {
    status: 'connected' | 'unavailable' | string;
    host?: string;
    port?: number;
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
  return error instanceof Error ? error.message : 'Could not connect to backend health endpoint.';
}

function latencyText(value: number | null): string {
  if (value === null || value === undefined) return 'Awaiting traffic';
  if (value < 0.1) return '< 0.10 ms';
  return `${value.toFixed(2)} ms`;
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
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  const fetchHealth = useCallback(async (isManual = false) => {
    if (!mountedRef.current) return;
    if (isManual) setRefreshing(true);

    try {
      // Direct call to /health via apiClient (which maps to /api/v1/health or /health via backend alias)
      const response = await apiClient.get<HealthResponse>('/health', {
        timeout: 8000,
      });

      if (!mountedRef.current) return;
      setHealth(response.data);
      setErrorMessage(null);
      setLastUpdated(new Date());
    } catch (error) {
      if (!mountedRef.current) return;
      // If error occurs, only set error if we don't already have health, or log it cleanly
      setErrorMessage(getErrorMessage(error));
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchHealth();

    const interval = window.setInterval(() => {
      void fetchHealth();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [fetchHealth]);

  const serviceOperational = health?.status === 'healthy';
  const databaseConnected = health?.database.status === 'connected';
  const redisConnected = health?.redis?.status === 'connected';
  const modelLoaded = health?.inference_engine.model_loaded === true;

  const cards = [
    {
      title: 'FastAPI Microservice',
      Icon: Server,
      operational: serviceOperational,
      status: loading
        ? 'Connecting…'
        : health
          ? serviceOperational
            ? 'Operational'
            : 'Degraded'
          : 'Offline',
      metricLabel: 'API Latency (p95)',
      metric: loading ? 'Measuring…' : health ? latencyText(health.latency.api_p95_ms) : '—',
      detail: health
        ? `${health.latency.api_sample_count} sample(s) recorded in rolling window`
        : 'Async ASGI server runtime on port 8000',
    },
    {
      title: 'PostgreSQL Relational DB',
      Icon: Database,
      operational: databaseConnected,
      status: loading
        ? 'Connecting…'
        : health
          ? databaseConnected
            ? 'Connected'
            : 'Unavailable'
          : 'Offline',
      metricLabel: 'Active Pool Connections',
      metric: loading
        ? 'Checking pool…'
        : health
          ? health.database.pool.active_connections === null
            ? 'Connected'
            : `${health.database.pool.active_connections}${
                health.database.pool.max_connections === null
                  ? ''
                  : ` / ${health.database.pool.max_connections}`
              }`
          : '—',
      detail: health
        ? `Idle: ${health.database.pool.idle_connections ?? '0'} · Pool size: ${health.database.pool.pool_size ?? '5'} (Port 5433)`
        : 'Persistent transactional graph ledger',
    },
    {
      title: 'Redis Velocity Cache',
      Icon: Zap,
      operational: Boolean(redisConnected),
      status: loading
        ? 'Connecting…'
        : health
          ? redisConnected
            ? 'Active'
            : 'Unavailable'
          : 'Offline',
      metricLabel: 'Cache Instance',
      metric: loading
        ? 'Connecting…'
        : health?.redis
          ? `${health.redis.host ?? '127.0.0.1'}:${health.redis.port ?? 6379}`
          : '—',
      detail: health
        ? redisConnected
          ? 'Sliding-window velocity tracking active'
          : 'Velocity cache unreachable (safe fallback mode)'
        : 'In-memory account velocity & rate tracking',
    },
    {
      title: 'ML Inference Engine',
      Icon: Cpu,
      operational: modelLoaded,
      status: loading
        ? 'Loading artifact…'
        : health
          ? modelLoaded
            ? 'Model Active'
            : 'Unavailable'
          : 'Offline',
      metricLabel: 'Artifact Version',
      metric: loading
        ? 'Checking artifact…'
        : health?.inference_engine.model_version ?? 'No model loaded',
      detail: health
        ? `Inference p95: ${latencyText(health.latency.inference_p95_ms)} · ${health.latency.inference_sample_count} sample(s)`
        : 'Vectorized Scikit-Learn Random Forest pipeline',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-mystic text-cyan-400 font-semibold flex items-center gap-1.5">
              <AegisWordmark size="xs" inline /> // SYSTEM OBSERVABILITY
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-slate-100 mt-1">
            System Health &amp; Observability
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Live telemetry for FastAPI backend, PostgreSQL connection pool, Redis velocity cache, and machine learning inference.
          </p>
        </div>

        {/* Status indicator & Refresh button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 font-mono">
            {loading ? (
              <LoaderCircle className="animate-spin text-cyan-400" size={14} />
            ) : health?.status === 'healthy' ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            )}
            <span>
              {loading
                ? 'Connecting to backend…'
                : lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString()} (every 10s)`
                  : 'Awaiting connection'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void fetchHealth(true)}
            disabled={refreshing || loading}
            title="Refresh system health metrics now"
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 hover:border-cyan-500/40 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors disabled:opacity-50 interactive-btn"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-cyan-400' : 'text-slate-400'} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div
          role="alert"
          className="animate-slide-down flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="shrink-0 text-rose-400" />
            <span>Connection Issue: {errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchHealth(true)}
            className="rounded-lg border border-rose-400/40 bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 transition-colors interactive-btn"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Observability Cards */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 xl:grid-cols-4">
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
              className="interactive-card group relative space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6 hover:border-cyan-500/30 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-slate-300">
                  <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400 group-hover:scale-105 transition-transform">
                    <Icon size={18} />
                  </div>
                  <h3 className="font-display text-sm sm:text-base font-semibold tracking-tight text-slate-200">
                    {title}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {operational && !loading && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  )}
                  {loading ? (
                    <LoaderCircle className="animate-spin text-slate-500" size={17} />
                  ) : (
                    <StatusIcon operational={Boolean(operational)} />
                  )}
                </div>
              </div>

              <div>
                <p
                  className={`text-lg sm:text-xl font-bold font-display ${
                    loading
                      ? 'text-slate-400'
                      : operational
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                  }`}
                >
                  {status}
                </p>
                <span className="mt-3 block text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
                  {metricLabel}
                </span>
                <p className="mt-1 break-words text-base sm:text-lg font-semibold font-mono text-slate-100">
                  {metric}
                </p>
                <span className="mt-2 block text-xs text-slate-400 font-sans">{detail}</span>
              </div>
            </section>
          )
        )}
      </div>

      {/* Telemetry Architecture Overview */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-cyan-400" size={18} />
            <h3 className="font-display text-base font-semibold text-slate-200">
              Architecture &amp; Cluster Telemetry
            </h3>
          </div>
          <span className="rounded-full bg-slate-800 border border-slate-700/60 px-2.5 py-0.5 text-xs font-mono text-slate-300">
            Stack v1.0.0
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <span className="text-slate-400 block font-mono text-xs">DATABASE INSTANCE</span>
            <p className="text-slate-200 font-semibold font-mono">PostgreSQL (Port 5433)</p>
            <p className="text-slate-400 text-xs">
              Connection pooling with SQLAlchemy engine. Dynamic overflow allocation enabled.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <span className="text-slate-400 block font-mono text-xs">INFERENCE PIPELINE</span>
            <p className="text-slate-200 font-semibold font-mono">
              {health?.inference_engine.model_version ?? 'aegis-rf-0.1.0'}
            </p>
            <p className="text-slate-400 text-xs">
              Random Forest with 100 estimators, standardized scaling, and explainable signal telemetry.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <span className="text-slate-400 block font-mono text-xs">VELOCITY TRACKER</span>
            <p className="text-slate-200 font-semibold font-mono">Redis sliding-window</p>
            <p className="text-slate-400 text-xs">
              Sub-millisecond rapid burst detection for coordinated entity card-testing attacks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
