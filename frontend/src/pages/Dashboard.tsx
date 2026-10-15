import React, { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  Activity,
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
  granularity?: 'hourly' | 'daily';
}

const numberFormat = new Intl.NumberFormat();

const formatTick = (value: string) => {
  if (value.includes('T')) {
    const timePart = value.split('T')[1];
    return timePart.slice(0, 5); // "HH:MM"
  }
  const parts = value.split('-');
  if (parts.length === 3) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return `${months[m]} ${d}`;
  }
  return value;
};

const formatTooltipLabel = (value: string) => {
  if (value.includes('T')) {
    const [d, t] = value.split('T');
    const dParts = d.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = parseInt(dParts[1], 10) - 1;
    const day = parseInt(dParts[2], 10);
    return `${months[m]} ${day}, ${t.slice(0, 5)}`;
  }
  const parts = value.split('-');
  if (parts.length === 3) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return `${months[m]} ${d}, ${parts[0]}`;
  }
  return value;
};

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

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (endDate && val > endDate) {
      setEndDate(val);
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (startDate && val < startDate) {
      setStartDate(val);
    }
  };

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
          // Set initial date range inputs to busiest period if not yet set
          if (!startDate && !endDate && response.data.busiest_period) {
            setStartDate(response.data.busiest_period.start_date);
            setEndDate(response.data.busiest_period.end_date);
          }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-fantasy text-2xl sm:text-3xl font-bold tracking-wide text-slate-100">
              Command Center
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time fraud oversight, operational metrics, and activity telemetry
          </p>
        </div>
      </div>

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

      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
                className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition-colors hover:border-slate-700/80"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 font-sans">{title}</span>
                  <Icon size={20} className={color} />
                </div>
                <p className={`mt-4 text-3xl font-fantasy font-bold ${color}`}>{value}</p>
                <span className="mt-2 inline-block text-xs text-slate-400 font-sans">
                  {detail}
                </span>
              </div>
            ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="font-fantasy text-base sm:text-lg font-semibold tracking-wide text-slate-200">
              Transaction &amp; Suspicious Activity Trend
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              These are dated from the transactions database.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full sm:flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setStartDate('2026-01-01');
                  setEndDate('2026-01-01');
                }}
                className={`whitespace-nowrap px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors border ${
                  startDate === '2026-01-01' && endDate === '2026-01-01'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                Jan 1 (Hourly)
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate('2026-01-02');
                  setEndDate('2026-01-02');
                }}
                className={`whitespace-nowrap px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors border ${
                  startDate === '2026-01-02' && endDate === '2026-01-02'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                Jan 2 (Hourly)
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate('2026-01-01');
                  setEndDate('2026-01-07');
                }}
                className={`whitespace-nowrap px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors border ${
                  startDate === '2026-01-01' && endDate === '2026-01-07'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                Jan 1–7
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate('2026-01-01');
                  setEndDate('2026-01-31');
                }}
                className={`whitespace-nowrap px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors border ${
                  startDate === '2026-01-01' && endDate === '2026-01-31'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                Full Month
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="dashboard-start-date" className="text-xs text-slate-400">
                From:
              </label>
              <input
                id="dashboard-start-date"
                type="date"
                value={startDate}
                min={overview?.available_range?.start_date}
                max={overview?.available_range?.end_date}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
              <label htmlFor="dashboard-end-date" className="text-xs text-slate-400">
                To:
              </label>
              <input
                id="dashboard-end-date"
                type="date"
                value={endDate}
                min={overview?.available_range?.start_date}
                max={overview?.available_range?.end_date}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <span>
            {startDate || overview?.available_range?.start_date || 'No start date'} –{' '}
            {endDate || overview?.available_range?.end_date || 'No end date'}
            {overview?.busiest_period
              ? ` · Busiest month: ${formatMonth(overview.busiest_period.start_date)} (${numberFormat.format(overview.busiest_period.transactions)} transactions)`
              : ''}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-cyan-300 text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {overview?.granularity === 'hourly' ? 'Hourly Timeline (24h View)' : 'Daily Timeline'}
          </span>
        </div>
        <div className="h-64 sm:h-72 lg:h-80 w-full">
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
                  tickFormatter={formatTick}
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
                  labelFormatter={(value) => formatTooltipLabel(String(value))}
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
