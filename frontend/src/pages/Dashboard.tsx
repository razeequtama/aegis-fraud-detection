import React, { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { Activity, CheckCircle2, ShieldAlert, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { apiClient } from '../api/client';

interface MetricsOverview {
  metrics: {
    total_transactions: number;
    review_queue_count: number;
    detected_frauds: number;
    model_status: 'online' | 'unavailable';
    model_version: string | null;
  };
  trend: {
    date: string;
    transactions: number;
    suspicious: number;
  }[];
}

const numberFormat = new Intl.NumberFormat();

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

export const Dashboard: React.FC = () => {
  const [overview, setOverview] = useState<MetricsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    const fetchOverview = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await apiClient.get<MetricsOverview>('/metrics/overview');
        if (active) {
          setOverview(response.data);
        }
      } catch (error: unknown) {
        if (active) {
          setErrorMessage(
            isAxiosError<{ detail?: string }>(error)
              ? error.response?.data?.detail ?? error.message
              : error instanceof Error
                ? error.message
                : 'Unable to load operational metrics.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchOverview();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const metricCards = overview
    ? [
        {
          title: 'Total Transactions',
          value: numberFormat.format(overview.metrics.total_transactions),
          detail: 'Transactions recorded in PostgreSQL',
          Icon: TrendingUp,
          color: 'text-cyan-400',
        },
        {
          title: 'Review Queue',
          value: numberFormat.format(overview.metrics.review_queue_count),
          detail: 'Open cases awaiting analyst review',
          Icon: ShieldAlert,
          color: 'text-amber-400',
        },
        {
          title: 'Detected Frauds',
          value: numberFormat.format(overview.metrics.detected_frauds),
          detail: 'Transactions labeled as suspicious',
          Icon: Activity,
          color: 'text-rose-400',
        },
        {
          title: 'Model Status',
          value:
            overview.metrics.model_status === 'online'
              ? overview.metrics.model_version ?? 'Online'
              : 'Unavailable',
          detail:
            overview.metrics.model_status === 'online'
              ? 'Risk model loaded and ready'
              : 'Risk model is not loaded',
          Icon: CheckCircle2,
          color:
            overview.metrics.model_status === 'online'
              ? 'text-emerald-400'
              : 'text-rose-400',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">Command Center</h2>

      {errorMessage && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300"
        >
          <span>Could not load operational metrics: {errorMessage}</span>
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            className="rounded-lg border border-rose-400/30 px-3 py-1.5 font-medium text-rose-200 hover:bg-rose-500/10"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-xl border border-slate-800 bg-slate-900 p-6"
              >
                <div className="h-4 w-32 rounded bg-slate-800" />
                <div className="mt-6 h-8 w-24 rounded bg-slate-800" />
                <div className="mt-3 h-3 w-40 rounded bg-slate-800" />
              </div>
            ))
          : metricCards.map(({ title, value, detail, Icon, color }) => (
              <div
                key={title}
                className="rounded-xl border border-slate-800 bg-slate-900 p-6"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-sm font-medium">{title}</span>
                  <Icon size={20} className={color} />
                </div>
                <p className={`mt-4 text-3xl font-bold ${color}`}>{value}</p>
                <span className="mt-2 inline-block text-xs text-slate-400">
                  {detail}
                </span>
              </div>
            ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-1 text-lg font-semibold text-slate-200">
          Transaction &amp; Suspicious Activity Trend
        </h3>
        <p className="mb-4 text-xs text-slate-400">
          Daily totals for the 14 days through the latest recorded transaction
        </p>
        <div className="h-72 w-full">
          {loading ? (
            <div className="h-full animate-pulse rounded-lg bg-slate-800/50" />
          ) : errorMessage ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Trend data is unavailable until metrics load.
            </div>
          ) : overview?.trend.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview.trend}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="#64748b"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  labelFormatter={(value) => formatDate(String(value))}
                  formatter={(value, name) => [
                    numberFormat.format(Number(value)),
                    name === 'transactions' ? 'Transactions' : 'Suspicious',
                  ]}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="transactions"
                  name="Transactions"
                  stroke="#06b6d4"
                  fill="#06b6d4"
                  fillOpacity={0.1}
                />
                <Area
                  type="monotone"
                  dataKey="suspicious"
                  name="Suspicious"
                  stroke="#f43f5e"
                  fill="#f43f5e"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No timestamped transactions are available to chart.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
