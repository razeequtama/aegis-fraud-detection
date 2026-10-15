import React, { useEffect, useState, useCallback, type FormEvent } from 'react';
import axios from 'axios';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Inbox,
  LoaderCircle,
  Monitor,
  Network,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  User,
  XCircle,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { AegisWordmark } from '../components/AegisWordmark';

type FeedbackLabel = 'confirmed_fraud' | 'legitimate' | 'inconclusive';

interface Transaction {
  transaction_id: string;
  timestamp: string | null;
  amount: number | null;
  type: string | null;
  account_id: string | null;
  device_id: string | null;
  session_id: string | null;
  oldbalance_org?: number | null;
  newbalance_orig?: number | null;
  oldbalance_dest?: number | null;
  newbalance_dest?: number | null;
  payment_attempts?: number | null;
  label: string | number | boolean | null;
  risk_score: number | null;
  decision: string | null;
  model_version: string | null;
}

interface RiskSignal {
  name?: string;
  description?: string;
  [key: string]: unknown;
}

interface EntityMetadata {
  id?: string | number | null;
  [key: string]: unknown;
}

interface InvestigationCase {
  case_id: string;
  transaction_id: string;
  assigned_analyst?: string | null;
  status?: string;
  notes?: string | null;
  feedback_label?: string | null;
  feedback_reasoning?: string | null;
  updated_at?: string | null;
}

interface TransactionDetailsResponse {
  data: {
    transaction: Transaction;
    risk_signals: RiskSignal[] | string[];
    related_entities: {
      account: EntityMetadata | null;
      device: EntityMetadata | null;
      session: EntityMetadata | null;
    };
    case: InvestigationCase | null;
  };
}

interface CaseItem {
  case_id: string;
  transaction_id: string;
  assigned_analyst: string;
  status: string;
  notes: string | null;
  feedback_label: string | null;
  feedback_reasoning: string | null;
  updated_at: string | null;
  amount: number | null;
  type: string | null;
  risk_score: number | null;
  is_fraud: number;
  account_id: string | null;
  timestamp: string | null;
}

interface CaseSummary {
  total_cases: number;
  open: number;
  in_review: number;
  closed: number;
  confirmed_fraud: number;
  legitimate: number;
  inconclusive: number;
}

interface UrgentAlert {
  transaction_id: string;
  account_id: string | null;
  amount: number;
  type: string;
  risk_score: number;
  device_id: string | null;
  case_id: string | null;
  case_status: string;
  timestamp: string | null;
}

const curatedCasePresets = [
  {
    txId: 'TX-100463',
    title: '53-Account Syndicate Transfer',
    type: 'TRANSFER',
    badge: 'Syndicate Ring',
    badgeColor: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    description: 'Shared device DEV-SIM-995 links 53 accounts with 17 flagged fraud nodes.',
  },
  {
    txId: 'TX-140135',
    title: 'High-Value Account Drain',
    type: 'CASH_OUT',
    badge: 'Critical Drain (Score 0.99)',
    badgeColor: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    description: 'Rp 2,988,103 cash out with 100% balance depletion on device DEV-SIM-360.',
  },
  {
    txId: 'TX-100033',
    title: 'Mule Ring Liquidation',
    type: 'CASH_OUT',
    badge: 'Mule Network',
    badgeColor: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    description: 'Rapid cash-out liquidation on shared emulator DEV-SIM-278.',
  },
  {
    txId: 'TX-100001',
    title: 'Clean Retail Baseline',
    type: 'PAYMENT',
    badge: 'Legitimate Baseline',
    badgeColor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    description: 'Normal merchant retail payment with zero anomaly signals.',
  },
];

const quickReasoningTags = [
  'Device Sharing Ring',
  '100% Account Drain',
  'Mule Account Funnel',
  'Customer Verified Legitimate',
  'Ledger Discrepancy Anomaly',
  'Multiple Payment Retries',
];

const feedbackActions: {
  label: FeedbackLabel;
  title: string;
  className: string;
  Icon: typeof CheckCircle;
}[] = [
  {
    label: 'confirmed_fraud',
    title: 'Confirm Fraud',
    className:
      'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40 hover:border-rose-500/60 shadow-sm shadow-rose-500/10',
    Icon: XCircle,
  },
  {
    label: 'legitimate',
    title: 'Mark Legitimate',
    className:
      'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40 hover:border-emerald-500/60 shadow-sm shadow-emerald-500/10',
    Icon: CheckCircle,
  },
  {
    label: 'inconclusive',
    title: 'Inconclusive',
    className:
      'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 hover:border-amber-500/60 shadow-sm shadow-amber-500/10',
    Icon: AlertTriangle,
  },
];

function formatError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    return typeof detail === 'string' ? detail : error.message;
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

function displayEntityId(entity: EntityMetadata | null): string {
  if (!entity) return 'Not available';
  return String(entity.id ?? 'Not available');
}

function formatIDR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'Not available';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export const Investigation: React.FC = () => {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();

  // Search Jump State
  const [searchJumpInput, setSearchJumpInput] = useState('');

  // Queue View State
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [caseSummary, setCaseSummary] = useState<CaseSummary | null>(null);
  const [urgentAlerts, setUrgentAlerts] = useState<UrgentAlert[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_review' | 'closed'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalCases, setTotalCases] = useState(0);

  // Single Transaction Investigation View State
  const [details, setDetails] = useState<TransactionDetailsResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [submittingLabel, setSubmittingLabel] = useState<FeedbackLabel | null>(null);
  const [analystReasoning, setAnalystReasoning] = useState('');
  const [analystNotes, setAnalystNotes] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Load Queue & Urgent Alerts
  const loadCaseQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const [casesRes, urgentRes] = await Promise.all([
        apiClient.get<{
          data: CaseItem[];
          total: number;
          summary: CaseSummary;
        }>('/cases', {
          params: {
            status: statusFilter === 'all' ? undefined : statusFilter,
            search: searchFilter.trim() || undefined,
            page,
            limit: 15,
          },
        }),
        apiClient.get<{ data: UrgentAlert[] }>('/cases/urgent', {
          params: { limit: 5 },
        }),
      ]);

      setCases(casesRes.data.data);
      setTotalCases(casesRes.data.total);
      setCaseSummary(casesRes.data.summary);
      setUrgentAlerts(urgentRes.data.data);
    } catch (err) {
      setQueueError(formatError(err));
    } finally {
      setQueueLoading(false);
    }
  }, [statusFilter, searchFilter, page]);

  useEffect(() => {
    if (!transactionId) {
      void loadCaseQueue();
    }
  }, [transactionId, loadCaseQueue]);

  // Load Single Transaction Details
  useEffect(() => {
    if (!transactionId) return;

    const controller = new AbortController();
    const loadTransaction = async () => {
      setLoading(true);
      setLoadError(null);
      setFeedbackError(null);
      setFeedbackMessage(null);
      try {
        const response = await apiClient.get<TransactionDetailsResponse>(
          `/transactions/${encodeURIComponent(transactionId)}`,
          { signal: controller.signal }
        );
        const data = response.data.data;
        setDetails(data);
        if (data.case?.feedback_reasoning) {
          setAnalystReasoning(data.case.feedback_reasoning);
        } else {
          setAnalystReasoning('');
        }
        if (data.case?.notes) {
          setAnalystNotes(data.case.notes);
        } else {
          setAnalystNotes('');
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(formatError(error));
          setDetails(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadTransaction();
    return () => controller.abort();
  }, [transactionId]);

  const handleSearchJump = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanId = searchJumpInput.trim();
    if (!cleanId) return;
    if (cleanId.toUpperCase().startsWith('CASE-')) {
      const match = cases.find((c) => c.case_id.toLowerCase() === cleanId.toLowerCase());
      if (match) {
        navigate(`/investigation/${encodeURIComponent(match.transaction_id)}`);
        return;
      }
    }
    navigate(`/investigation/${encodeURIComponent(cleanId)}`);
  };

  const handleReopenCase = async () => {
    if (!details?.case?.case_id) return;
    setIsUpdatingStatus(true);
    setFeedbackError(null);
    try {
      await apiClient.patch(`/cases/${encodeURIComponent(details.case.case_id)}`, {
        status: 'in_review',
      });
      setDetails((prev) =>
        prev && prev.case
          ? {
              ...prev,
              case: {
                ...prev.case,
                status: 'in_review',
              },
            }
          : prev
      );
      setFeedbackMessage('Case reopened for investigation (status: in_review).');
    } catch (err) {
      setFeedbackError(`Could not reopen case: ${formatError(err)}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const submitFeedback = async (label: FeedbackLabel, title: string) => {
    if (!details || !transactionId) return;

    setSubmittingLabel(label);
    setFeedbackError(null);
    setFeedbackMessage(null);
    try {
      let caseId = details.case?.case_id;
      if (!caseId) {
        const caseResponse = await apiClient.post<{ data: InvestigationCase }>('/cases', {
          transaction_id: transactionId,
          assigned_analyst: 'Analyst',
          initial_status: 'in_review',
        });
        caseId = caseResponse.data.data.case_id;
        if (!caseId) throw new Error('The backend did not return the created case ID.');
        setDetails((current) =>
          current
            ? {
                ...current,
                case: { case_id: caseId ?? 'NEW-CASE', transaction_id: transactionId, status: 'in_review' },
              }
            : current
        );
      }

      const finalReasoning = analystReasoning.trim()
        ? analystReasoning.trim()
        : `Analyst selected: ${title}`;

      const response = await apiClient.post<{ message?: string }>(
        `/cases/${encodeURIComponent(caseId)}/feedback`,
        {
          analyst_id: 'Analyst',
          label,
          reasoning: finalReasoning,
          notes: analystNotes.trim() || undefined,
        }
      );

      setDetails((current) =>
        current
          ? {
              ...current,
              case: {
                ...(current.case ?? { case_id: caseId, transaction_id: transactionId }),
                status: 'closed',
                feedback_label: label,
                feedback_reasoning: finalReasoning,
                notes: analystNotes.trim() || current.case?.notes,
              },
            }
          : current
      );
      setFeedbackMessage(response.data.message ?? `Feedback recorded: ${title}.`);
    } catch (error) {
      setFeedbackError(`Could not save analyst feedback: ${formatError(error)}`);
    } finally {
      setSubmittingLabel(null);
    }
  };

  // ==========================================
  // VIEW 1: Case Management Queue (/investigation)
  // ==========================================
  if (!transactionId) {
    return (
      <div className="space-y-6">
        {/* Header & Direct ID Search */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center border-b border-slate-800/60 pb-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-mystic text-cyan-400 font-semibold flex items-center gap-1.5">
              <AegisWordmark size="xs" inline /> // CASE OPERATIONS
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-slate-100 mt-1">
              Fraud Investigation Hub
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Review prioritized case queues, analyze explainable ML signals, and record feedback decisions for retraining.
            </p>
          </div>


          <form onSubmit={handleSearchJump} className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchJumpInput}
                onChange={(e) => setSearchJumpInput(e.target.value)}
                placeholder="Enter Transaction or Case ID…"
                className="w-full sm:w-64 rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none interactive-input"
              />
            </div>
            <button
              type="submit"
              className="shrink-0 flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 sm:px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 interactive-btn"
            >
              Investigate <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 interactive-card hover:border-slate-700 cursor-default">
            <span className="text-sm font-medium text-slate-300">Total Cases</span>
            <div className="mt-2 text-2xl font-bold text-slate-100">
              {caseSummary ? caseSummary.total_cases : '—'}
            </div>
            <span className="mt-1 block text-xs text-slate-400">Tracked in database</span>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 interactive-card hover:border-amber-500/50 cursor-default">
            <span className="text-sm font-medium text-amber-300">Open / Pending Review</span>
            <div className="mt-2 text-2xl font-bold text-amber-400">
              {caseSummary ? caseSummary.open + caseSummary.in_review : '—'}
            </div>
            <span className="mt-1 block text-xs text-amber-300/90">Requires analyst action</span>
          </div>

          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 interactive-card hover:border-rose-500/50 cursor-default">
            <span className="text-sm font-medium text-rose-300">Confirmed Fraud</span>
            <div className="mt-2 text-2xl font-bold text-rose-400">
              {caseSummary ? caseSummary.confirmed_fraud : '—'}
            </div>
            <span className="mt-1 block text-xs text-rose-300/90">Ready for training loop</span>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 interactive-card hover:border-emerald-500/50 cursor-default">
            <span className="text-sm font-medium text-emerald-300">Cleared / Legitimate</span>
            <div className="mt-2 text-2xl font-bold text-emerald-400">
              {caseSummary ? caseSummary.legitimate : '—'}
            </div>
            <span className="mt-1 block text-xs text-emerald-300/90">False positive mitigation</span>
          </div>
        </div>

        {/* Curated Case Presets */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-cyan-400" />
              <h3 className="font-display text-base font-semibold tracking-wide text-slate-200">Curated Investigation Presets</h3>
            </div>
            <span className="text-sm text-slate-300">1-click select real database patterns</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {curatedCasePresets.map((preset) => (
              <button
                key={preset.txId}
                type="button"
                onClick={() => navigate(`/investigation/${preset.txId}`)}
                className="group flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 text-left interactive-card hover:border-cyan-500/50 hover:bg-slate-800/60"
              >
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold border ${preset.badgeColor}`}>
                      {preset.badge}
                    </span>
                    <span className="font-mono text-xs text-cyan-400 group-hover:underline">
                      {preset.txId}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100 group-hover:text-cyan-200 transition-colors">
                    {preset.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-300 line-clamp-2">
                    {preset.description}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-end text-xs font-semibold text-cyan-400">
                  Open Case <ArrowRight size={13} className="ml-1 transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Grid: Case Management Queue + Urgent Alerts Side Panel */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Case Table (2 Cols) */}
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              {/* Table Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
                <div className="flex items-center gap-1.5">
                  <Filter size={15} className="text-slate-400" />
                  <div className="flex gap-1 rounded-lg bg-slate-950 p-1">
                    {(['all', 'open', 'in_review', 'closed'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setStatusFilter(st);
                          setPage(1);
                        }}
                        className={`rounded px-2.5 py-1 text-xs sm:text-sm font-medium capitalize transition-all duration-150 interactive-btn ${
                          statusFilter === st
                            ? 'bg-cyan-500/20 text-cyan-300 shadow-sm shadow-cyan-500/10'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {st === 'in_review' ? 'In Review' : st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => {
                      setSearchFilter(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Filter cases…"
                    className="w-48 rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none interactive-input"
                  />
                </div>
              </div>

              {/* Table Content */}
              {queueLoading ? (
                <div className="flex items-center justify-center p-12 text-sm text-slate-400">
                  <LoaderCircle className="mr-2 animate-spin text-cyan-400" size={18} />
                  Loading case queue…
                </div>
              ) : queueError ? (
                <div className="p-6 text-center text-sm text-rose-400 animate-slide-down">
                  <AlertTriangle className="mx-auto mb-2" size={24} />
                  {queueError}
                </div>
              ) : cases.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  <Inbox className="mx-auto mb-2 text-slate-600" size={32} />
                  No cases found for the selected filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[660px] text-left text-sm">
                    <thead className="border-b border-slate-800 bg-slate-950/50 uppercase tracking-wider text-xs font-semibold text-slate-300 whitespace-nowrap">
                      <tr>
                        <th className="px-4 py-3">Case ID</th>
                        <th className="px-4 py-3">Transaction</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Risk Score</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Outcome</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 whitespace-nowrap">
                      {cases.map((c) => {
                        const score = c.risk_score ?? 0;
                        return (
                          <tr key={c.case_id} className="transition-colors duration-150 hover:bg-slate-800/50">
                            <td className="px-4 py-3 font-mono font-medium text-slate-300">
                              {c.case_id}
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                to={`/investigation/${c.transaction_id}`}
                                className="font-mono text-cyan-400 hover:underline transition-colors"
                              >
                                {c.transaction_id}
                              </Link>
                              <span className="block text-xs text-slate-400 mt-0.5">{c.type ?? 'TRANSFER'}</span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-200">
                              {formatIDR(c.amount)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`font-mono font-bold ${
                                  score >= 0.75
                                    ? 'text-rose-400'
                                    : score >= 0.4
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {score.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize border transition-colors ${
                                  c.status === 'open'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : c.status === 'in_review'
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                    : 'bg-slate-700/40 text-slate-300 border border-slate-600'
                                }`}
                              >
                                {c.status === 'in_review' ? 'In Review' : c.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {c.feedback_label ? (
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize border transition-colors ${
                                    c.feedback_label === 'confirmed_fraud'
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                      : c.feedback_label === 'legitimate'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  }`}
                                >
                                  {c.feedback_label.replace('_', ' ')}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Pending</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => navigate(`/investigation/${c.transaction_id}`)}
                                className="rounded border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 interactive-btn"
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Footer */}
              <div className="flex items-center justify-between border-t border-slate-800 p-4 text-sm text-slate-300">
                <span>
                  Showing {cases.length} of {totalCases} cases
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded border border-slate-700 bg-slate-800 px-3 py-1 disabled:opacity-40 interactive-btn"
                  >
                    Previous
                  </button>
                  <span className="font-mono text-slate-200">Page {page}</span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={cases.length < 15}
                    className="rounded border border-slate-700 bg-slate-800 px-3 py-1 disabled:opacity-40 interactive-btn"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Urgent Alerts Side Panel (1 Col) */}
          <div className="space-y-4">
            <div className="rounded-xl border border-rose-500/30 bg-slate-900 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-rose-400" />
                  <h3 className="font-display text-base font-semibold tracking-wide text-slate-100">Critical Alerts Inbox</h3>
                </div>
                <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-300 animate-pulse-subtle">
                  Priority
                </span>
              </div>
              <p className="text-sm text-slate-300 mb-4">
                High-risk transactions exceeding decline threshold that require urgent review.
              </p>

              <div className="space-y-2.5">
                {urgentAlerts.length ? (
                  urgentAlerts.map((alert) => (
                    <div
                      key={alert.transaction_id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm interactive-card hover:border-rose-500/40"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-cyan-400">
                            {alert.transaction_id}
                          </span>
                          <span className="rounded bg-rose-500/10 px-1.5 py-0.5 font-mono font-bold text-rose-400 text-xs">
                            {alert.risk_score.toFixed(2)}
                          </span>
                        </div>
                        <span className="mt-1 block font-medium text-slate-300">
                          {formatIDR(alert.amount)} · {alert.type}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/investigation/${alert.transaction_id}`)}
                        className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 interactive-btn"
                      >
                        Investigate
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 italic">No pending urgent alerts.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: Single Transaction Deep-Dive Investigation
  // ==========================================
  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900 p-16 text-slate-400">
        <LoaderCircle className="mr-3 animate-spin text-cyan-400" size={24} />
        Loading transaction, ledger balances, and risk signals…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Could not load transaction details: {loadError}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Retry
          </button>
          <Link
            to="/investigation"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Back to Cases
          </Link>
        </div>
      </div>
    );
  }

  if (!details) return null;

  const { transaction, risk_signals: signals, related_entities: entities, case: investigationCase } = details;
  const isCaseClosed = investigationCase?.status === 'closed';

  return (
    <div className="space-y-6">
      {/* Top Navigation & Case Status Bar */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/investigation"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-400 hover:underline"
            >
              <ArrowLeft size={15} /> Back to Case Queue
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-sm text-slate-300 font-mono">
              {investigationCase?.case_id ?? 'Auto-Assigned Case'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 bg-gradient-to-b from-cyan-400 to-blue-600 rounded-full" />
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-100 break-all sm:break-normal">
                Case Investigation: <span className="font-mono text-cyan-400 font-semibold">{transaction.transaction_id}</span>
              </h2>
            </div>
            <span
              className={`rounded-full px-3 py-0.5 text-sm font-medium capitalize border ${
                investigationCase?.status === 'closed'
                  ? 'border-slate-600 bg-slate-800 text-slate-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              }`}
            >
              {investigationCase?.status ?? 'open'}
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400 pl-3">
            {transaction.model_version ? (
              `Inference Engine: ${transaction.model_version}`
            ) : (
              <>
                Live <AegisWordmark size="xs" inline /> Model &amp; Graph Engine
              </>
            )}
            {investigationCase?.assigned_analyst ? ` • Assigned to ${investigationCase.assigned_analyst}` : ''}
          </p>
        </div>


        {/* Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/network/transactions/${encodeURIComponent(transaction.transaction_id)}`}
            className="flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-sm font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20 interactive-btn"
          >
            <Network size={16} />
            Explore in Network Graph
          </Link>
          {isCaseClosed && (
            <button
              type="button"
              onClick={handleReopenCase}
              disabled={isUpdatingStatus}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50 interactive-btn"
            >
              <RotateCcw size={14} />
              Reopen Case
            </button>
          )}
        </div>
      </div>

      {/* Analyst Decision & Feedback Workspace */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold tracking-wide text-slate-100">Analyst Case Disposition</h3>
            <p className="text-sm text-slate-300">
              Record ground-truth feedback. Labeled feedback feeds into future model calibration and replay simulations.
            </p>
          </div>
          {investigationCase?.feedback_label && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">Recorded Label:</span>
              <span
                className={`rounded-full px-3 py-0.5 text-sm font-semibold capitalize border ${
                  investigationCase.feedback_label === 'confirmed_fraud'
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                    : investigationCase.feedback_label === 'legitimate'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                }`}
              >
                {investigationCase.feedback_label.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>

        {/* Quick Reasoning Tags */}
        <div>
          <span className="block text-sm font-medium text-slate-300 mb-2">Quick Reasoning Tags:</span>
          <div className="flex flex-wrap gap-1.5">
            {quickReasoningTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setAnalystReasoning((prev) => (prev ? `${prev}, ${tag}` : tag));
                }}
                className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs sm:text-sm text-slate-200 hover:border-cyan-500/50 hover:text-cyan-200 interactive-btn"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Reasoning Text Input */}
        <div>
          <label htmlFor="analyst-reasoning" className="block text-sm font-medium text-slate-300 mb-1.5">
            Analyst Notes &amp; Justification
          </label>
          <textarea
            id="analyst-reasoning"
            rows={2}
            value={analystReasoning}
            onChange={(e) => setAnalystReasoning(e.target.value)}
            placeholder="Document observed pattern, device links, or reason for clearance…"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none interactive-input"
          />
        </div>

        {/* Feedback Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
          {feedbackActions.map(({ label, title, className, Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => void submitFeedback(label, title)}
              disabled={submittingLabel !== null}
              className={`flex-1 sm:flex-initial justify-center flex items-center gap-2 rounded-lg border px-3 sm:px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 interactive-btn ${className}`}
            >
              <Icon size={16} />
              {submittingLabel === label ? 'Saving Decision…' : title}
            </button>
          ))}
        </div>

        {feedbackMessage && (
          <div role="status" className="animate-slide-down flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            <CheckCircle2 size={16} />
            {feedbackMessage}
          </div>
        )}
        {feedbackError && (
          <div role="alert" className="animate-slide-down flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
            <AlertCircle size={16} />
            {feedbackError}
          </div>
        )}
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Transaction Details, Ledger Progression, and Risk Signals */}
        <div className="space-y-6 lg:col-span-2">
          {/* Transaction Metadata & Risk Gauge */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold tracking-wide text-slate-200">Transaction Profile</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-300">Risk Score:</span>
                <span
                  className={`font-mono text-base font-bold ${
                    (transaction.risk_score ?? 0) >= 0.75
                      ? 'text-rose-400'
                      : (transaction.risk_score ?? 0) >= 0.4
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {typeof transaction.risk_score === 'number'
                    ? transaction.risk_score.toFixed(4)
                    : transaction.risk_score ?? 'N/A'}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase border ${
                    transaction.decision === 'decline'
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                      : transaction.decision === 'review'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  }`}
                >
                  {transaction.decision ?? 'EVALUATED'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-slate-950 p-3.5">
                <span className="block text-xs font-medium text-slate-400 mb-0.5">Transaction Amount</span>
                <span className="text-xl font-bold text-slate-100">{formatIDR(transaction.amount)}</span>
              </div>
              <div className="rounded-lg bg-slate-950 p-3.5">
                <span className="block text-xs font-medium text-slate-400 mb-0.5">Type</span>
                <span className="text-base font-semibold text-slate-200">{transaction.type ?? 'TRANSFER'}</span>
              </div>
              <div className="rounded-lg bg-slate-950 p-3.5">
                <span className="block text-xs font-medium text-slate-400 mb-0.5">Timestamp</span>
                <span className="font-medium text-slate-200">
                  {transaction.timestamp ? new Date(transaction.timestamp).toLocaleString() : 'Not available'}
                </span>
              </div>
              <div className="rounded-lg bg-slate-950 p-3.5">
                <span className="block text-xs font-medium text-slate-400 mb-0.5">Payment Attempts</span>
                <span className="font-medium text-slate-200">
                  {transaction.payment_attempts ?? 1} attempt(s)
                </span>
              </div>
            </div>
          </section>

          {/* Ledger & Balance Progression */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 className="font-display text-base font-semibold tracking-wide text-slate-200">Ledger Balance State &amp; Account Depletion</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
              {/* Origin Account */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2">
                <span className="font-semibold text-cyan-400 uppercase tracking-wider text-xs">
                  Origin Account (Source)
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Old Balance:</span>
                  <span className="font-mono text-slate-200">{formatIDR(transaction.oldbalance_org)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">New Balance:</span>
                  <span className="font-mono text-slate-200">{formatIDR(transaction.newbalance_orig)}</span>
                </div>
                {typeof transaction.oldbalance_org === 'number' &&
                  typeof transaction.amount === 'number' &&
                  transaction.oldbalance_org > 0 && (
                    <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between">
                      <span className="text-slate-300">Balance Drain Ratio:</span>
                      <span className="font-mono font-bold text-amber-400">
                        {((transaction.amount / transaction.oldbalance_org) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
              </div>

              {/* Destination Account */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2">
                <span className="font-semibold text-slate-300 uppercase tracking-wider text-xs">
                  Destination Account
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Old Balance:</span>
                  <span className="font-mono text-slate-200">{formatIDR(transaction.oldbalance_dest)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">New Balance:</span>
                  <span className="font-mono text-slate-200">{formatIDR(transaction.newbalance_dest)}</span>
                </div>
                <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between">
                  <span className="text-slate-300">Destination Account ID:</span>
                  <span className="font-mono text-slate-200">
                    {displayEntityId(entities.account)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Explainable Risk Signals */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold tracking-wide text-slate-200">Explainable Risk Signals</h3>
              <span className="text-sm text-slate-300">{signals.length} triggered signal(s)</span>
            </div>

            {signals.length ? (
              <div className="space-y-3">
                {signals.map((signal, index) => {
                  const name = typeof signal === 'string' ? signal : signal.name ?? 'Risk Signal';
                  const description =
                    typeof signal === 'string'
                      ? signal
                      : signal.description ?? 'Signal triggered based on behavioral anomaly patterns.';
                  const isCritical =
                    name.includes('critical') ||
                    name.includes('ultra') ||
                    name.includes('high_fraud') ||
                    name.includes('burst');

                  return (
                    <div
                      key={`${name}-${index}`}
                      className={`flex items-start gap-3 rounded-lg border p-3.5 text-sm ${
                        isCritical
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      }`}
                    >
                      <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                      <div>
                        <h4 className="font-bold uppercase tracking-wider text-xs">
                          {name.replace(/_/g, ' ')}
                        </h4>
                        <p className="mt-1 text-slate-200 text-sm leading-relaxed">{description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No stored risk signals are available for this transaction.</p>
            )}
          </section>
        </div>

        {/* Right Column: Related Entities & Network Graph Jump */}
        <aside className="space-y-6">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 className="font-display text-base font-semibold tracking-wide text-slate-200">Entity Relationships</h3>

            <div className="space-y-4 text-sm">
              {/* Account Link */}
              <div className="flex items-start justify-between rounded-lg bg-slate-950 p-3.5">
                <div className="flex items-start gap-2.5">
                  <User size={18} className="mt-0.5 text-cyan-400" />
                  <div>
                    <span className="block text-xs text-slate-400 font-medium">Source Account</span>
                    <span className="font-mono text-sm text-slate-200">{transaction.account_id ?? 'N/A'}</span>
                  </div>
                </div>
                {transaction.account_id && (
                  <Link
                    to={`/network/accounts/${encodeURIComponent(transaction.account_id)}`}
                    className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-cyan-400 hover:underline"
                  >
                    Graph <ExternalLink size={13} />
                  </Link>
                )}
              </div>

              {/* Device Link */}
              <div className="flex items-start justify-between rounded-lg bg-slate-950 p-3.5">
                <div className="flex items-start gap-2.5">
                  <Monitor size={18} className="mt-0.5 text-cyan-400" />
                  <div>
                    <span className="block text-xs text-slate-400 font-medium">Device Hardware</span>
                    <span className="font-mono text-sm text-slate-200">{transaction.device_id ?? 'N/A'}</span>
                  </div>
                </div>
                {transaction.device_id && (
                  <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs font-mono text-cyan-300">
                    Shared
                  </span>
                )}
              </div>

              {/* Session Link */}
              <div className="flex items-start gap-2.5 rounded-lg bg-slate-950 p-3.5">
                <Clock size={18} className="mt-0.5 text-cyan-400" />
                <div>
                  <span className="block text-xs text-slate-400 font-medium">Session ID</span>
                  <span className="font-mono text-sm text-slate-200">{transaction.session_id ?? 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Quick Action Button to Network */}
            <div className="pt-2">
              <Link
                to={`/network/transactions/${encodeURIComponent(transaction.transaction_id)}`}
                className="flex items-center justify-center gap-2 w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 interactive-btn"
              >
                <Network size={16} />
                Visualize Full Syndicate Ring
              </Link>
            </div>
          </section>

          {/* Case Audit Trail */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-3 text-sm">
            <h3 className="font-display text-base font-semibold tracking-wide text-slate-200 flex items-center gap-2">
              <FileText size={17} className="text-slate-400" />
              Investigation Case Record
            </h3>
            <div className="space-y-2.5 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Case ID:</span>
                <span className="font-mono text-slate-200">{investigationCase?.case_id ?? 'Not Assigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="capitalize font-semibold text-slate-100">
                  {investigationCase?.status ?? 'Open'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Assigned Analyst:</span>
                <span className="text-slate-200">{investigationCase?.assigned_analyst ?? 'Unassigned'}</span>
              </div>
              {investigationCase?.feedback_reasoning && (
                <div className="border-t border-slate-800 pt-2.5">
                  <span className="block text-slate-400 font-medium mb-1">Saved Reasoning:</span>
                  <p className="rounded bg-slate-950 p-2.5 text-slate-200 italic">
                    "{investigationCase.feedback_reasoning}"
                  </p>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
