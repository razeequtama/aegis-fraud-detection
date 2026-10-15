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
import { AegisWordmark } from '../components/AegisWordmark';
import { PageGuideButton } from '../components/PageGuideButton';
import { useTranslation } from '../i18n/LanguageContext';

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

export const Dashboard: React.FC = () => {
  const { t, language } = useTranslation();
  const [overview, setOverview] = useState<MetricsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const formatMonth = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });

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
          title: t.dashboard.totalTransactions,
          value: numberFormat.format(overview.metrics.total_transactions),
          detail: t.dashboard.totalTransactionsDesc,
          Icon: TrendingUp,
          color: 'text-slate-100',
          iconColor: 'text-cyan-400',
        },
        {
          title: t.dashboard.reviewQueue,
          value: numberFormat.format(overview.metrics.review_queue_count),
          detail: t.dashboard.reviewQueueDesc,
          Icon: ShieldAlert,
          color: 'text-cyan-300',
          iconColor: 'text-cyan-400',
        },
        {
          title: t.dashboard.detectedFrauds,
          value: numberFormat.format(overview.metrics.detected_frauds),
          detail: t.dashboard.detectedFraudsDesc,
          Icon: Activity,
          color: 'text-cyan-100',
          iconColor: 'text-cyan-300',
        },
        {
          title: t.dashboard.modelStatus,
          value:
            overview.metrics.model_status === 'online'
              ? overview.metrics.model_version ?? t.common.online
              : t.common.unavailable,
          detail:
            overview.metrics.model_status === 'online'
              ? t.dashboard.modelLoadedDesc
              : t.dashboard.modelNotLoadedDesc,
          Icon: CheckCircle2,
          color:
            overview.metrics.model_status === 'online'
              ? 'text-cyan-400'
              : 'text-slate-400',
          iconColor:
            overview.metrics.model_status === 'online'
              ? 'text-cyan-400'
              : 'text-slate-500',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 border-b border-slate-800/60 pb-4">
        <div>
          <span className="text-xs sm:text-sm font-mono uppercase tracking-mystic text-cyan-400 font-semibold flex items-center gap-1.5">
            <AegisWordmark size="xs" inline /> {t.dashboard.tag}
          </span>
          <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-slate-100 mt-1">
            {t.dashboard.title}
          </h2>
          <p className="text-sm sm:text-base text-slate-300 mt-1">
            {t.dashboard.subtitle}
          </p>
        </div>

        <PageGuideButton page="dashboard" />
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300 animate-slide-down"
        >
          <span>{t.dashboard.errorPrefix} {errorMessage}</span>
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            className="rounded-lg border border-rose-400/30 px-3.5 py-1.5 font-medium text-rose-200 hover:bg-rose-500/20 interactive-btn text-sm"
          >
            {t.common.retry}
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
          : metricCards.map(({ title, value, detail, Icon, color, iconColor }) => (
              <div
                key={title}
                className="rounded-xl border border-slate-800 bg-slate-900 p-6 interactive-card hover:border-slate-700 group cursor-default"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs sm:text-sm uppercase tracking-wider font-semibold text-slate-300 font-mono">{title}</span>
                  <Icon size={20} className={`${iconColor || color} transition-transform duration-200 ease-out group-hover:scale-110`} />
                </div>
                <p className={`mt-4 text-3xl font-mono font-bold tracking-tight ${color}`}>{value}</p>
                <span className="mt-2 inline-block text-sm text-slate-300 font-sans">
                  {detail}
                </span>
              </div>
            ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6 transition-colors duration-200">
        <div className="mb-5 flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div>
            <h3 className="font-display text-lg sm:text-xl font-semibold tracking-tight text-slate-100">
              {t.dashboard.chartTitle}
            </h3>

            <p className="mt-1 text-sm text-slate-300">
              {t.dashboard.chartSubtitle}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto pb-1 2xl:pb-0 max-w-full">
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setStartDate('2026-01-01');
                  setEndDate('2026-01-01');
                }}
                className={`whitespace-nowrap px-3.5 py-1.5 text-sm rounded-lg font-medium transition-all duration-150 border interactive-btn ${
                  startDate === '2026-01-01' && endDate === '2026-01-01'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                {t.dashboard.btnJan1}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate('2026-01-02');
                  setEndDate('2026-01-02');
                }}
                className={`whitespace-nowrap px-3.5 py-1.5 text-sm rounded-lg font-medium transition-all duration-150 border interactive-btn ${
                  startDate === '2026-01-02' && endDate === '2026-01-02'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                {t.dashboard.btnJan2}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate('2026-01-01');
                  setEndDate('2026-01-07');
                }}
                className={`whitespace-nowrap px-3.5 py-1.5 text-sm rounded-lg font-medium transition-all duration-150 border interactive-btn ${
                  startDate === '2026-01-01' && endDate === '2026-01-07'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                {t.dashboard.btnJanWeek}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate('2026-01-01');
                  setEndDate('2026-01-31');
                }}
                className={`whitespace-nowrap px-3.5 py-1.5 text-sm rounded-lg font-medium transition-all duration-150 border interactive-btn ${
                  startDate === '2026-01-01' && endDate === '2026-01-31'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                {t.dashboard.btnFullMonth}
              </button>
            </div>

            <div className="h-5 w-px bg-slate-800 shrink-0 mx-1" />

            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="dashboard-start-date" className="text-sm font-medium text-slate-300 whitespace-nowrap">
                {t.dashboard.fromLabel}
              </label>
              <input
                id="dashboard-start-date"
                type="date"
                value={startDate}
                min={overview?.available_range?.start_date}
                max={overview?.available_range?.end_date}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none interactive-input"
              />
              <label htmlFor="dashboard-end-date" className="text-sm font-medium text-slate-300 whitespace-nowrap">
                {t.dashboard.toLabel}
              </label>
              <input
                id="dashboard-end-date"
                type="date"
                value={endDate}
                min={overview?.available_range?.start_date}
                max={overview?.available_range?.end_date}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none interactive-input"
              />
            </div>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between text-sm text-slate-300 gap-2">
          <span>
            {startDate || overview?.available_range?.start_date || t.dashboard.noStartDate} –{' '}
            {endDate || overview?.available_range?.end_date || t.dashboard.noEndDate}
            {overview?.busiest_period
              ? ` · ${t.dashboard.busiestMonthPrefix} ${formatMonth(overview.busiest_period.start_date)} (${numberFormat.format(overview.busiest_period.transactions)} ${t.dashboard.transactionsWord})`
              : ''}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-cyan-300 text-xs sm:text-sm font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            {overview?.granularity === 'hourly' ? t.dashboard.hourlyView : t.dashboard.dailyView}
          </span>
        </div>
        <div className="h-64 sm:h-72 lg:h-80 w-full">
          {loading ? (
            <div className="h-full animate-pulse rounded-lg bg-slate-800/50" />
          ) : errorMessage ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {t.dashboard.trendUnavailable}
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
                    name === 'Transactions' || name === 'transactions' || name === t.dashboard.tooltipTransactions
                      ? t.dashboard.tooltipTransactions
                      : t.dashboard.tooltipSuspicious,
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
                  name={t.dashboard.tooltipTransactions}
                  stroke="#06b6d4"
                  fill="#06b6d4"
                  fillOpacity={0.1}
                />
                <Area
                  type="monotone"
                  dataKey="suspicious"
                  name={t.dashboard.tooltipSuspicious}
                  stroke="#f43f5e"
                  fill="#f43f5e"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {t.dashboard.noTimestamped}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
