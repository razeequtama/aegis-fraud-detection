import React, { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
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
  available_range: {
    start_date: string;
    end_date: string;
  } | null;
  busiest_period: {
    start_date: string;
    end_date: string;
    transactions: number;
  } | null;
}

const numberFormat = new Intl.NumberFormat();

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

const formatMonth = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

export const Dashboard: React.FC = () => {
  const [overview, setOverview] = useState<MetricsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    let active = true;

    const fetchOverview = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await apiClient.get<MetricsOverview>('/metrics/overview', {
          params: {
            ...(startDate ? { start_date: startDate } : {}),
            ...(endDate ? { end_date: endDate } : {}),
          },
        });
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
  }, [endDate, refreshKey, startDate]);

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
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-200">
              Transaction &amp; Suspicious Activity Trend
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Choose any date range in the recorded transaction history.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs text-slate-400">
              From
              <input
                aria-label="Trend start date"
                type="date"
                min={overview?.available_range?.start_date}
                max={endDate || overview?.available_range?.end_date}
                value={startDate || overview?.available_range?.start_date || ''}
                onChange={(event) => setStartDate(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-400">
              To
              <input
                aria-label="Trend end date"
                type="date"
                min={startDate || overview?.available_range?.start_date}
                max={overview?.available_range?.end_date}
                value={endDate || overview?.available_range?.end_date || ''}
                onChange={(event) => setEndDate(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              />
            </label>
            <button
              type="button"
              disabled={!overview?.busiest_period || loading}
              onClick={() => {
                if (!overview?.busiest_period) return;
                setStartDate(overview.busiest_period.start_date);
                setEndDate(overview.busiest_period.end_date);
              }}
              className="flex items-center gap-2 rounded-lg border border-cyan-500/30 px-3 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CalendarDays size={16} />
              Busiest period
            </button>
          </div>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          {startDate || overview?.available_range?.start_date || 'No start date'} –{' '}
          {endDate || overview?.available_range?.end_date || 'No end date'}
          {overview?.busiest_period
            ? ` · Busiest month: ${formatMonth(overview.busiest_period.start_date)} (${numberFormat.format(overview.busiest_period.transactions)} transactions)`
            : ''}
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
                    name === 'Transactions' || name === 'transactions'
                      ? 'Transactions'
                      : 'Suspicious',
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
              No timestamped transactions are available in this date range.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
