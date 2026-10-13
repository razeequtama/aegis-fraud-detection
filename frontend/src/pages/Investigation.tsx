import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Monitor,
  User,
  XCircle,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';

type FeedbackLabel = 'confirmed_fraud' | 'legitimate' | 'inconclusive';

interface Transaction {
  transaction_id: string;
  timestamp: string | null;
  amount: number | null;
  type: string | null;
  account_id: string | null;
  device_id: string | null;
  session_id: string | null;
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
  status?: string;
  feedback_label?: string | null;
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
      'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30',
    Icon: XCircle,
  },
  {
    label: 'legitimate',
    title: 'Mark Legitimate',
    className:
      'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Icon: CheckCircle,
  },
  {
    label: 'inconclusive',
    title: 'Inconclusive',
    className:
      'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30',
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

export const Investigation: React.FC = () => {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [details, setDetails] = useState<TransactionDetailsResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [submittingLabel, setSubmittingLabel] = useState<FeedbackLabel | null>(null);

  useEffect(() => {
    if (!transactionId) {
      return;
    }

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
        setDetails(response.data.data);
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
                case: { case_id: caseId, status: 'in_review' },
              }
            : current
        );
      }

      const response = await apiClient.post<{ message?: string }>(
        `/cases/${encodeURIComponent(caseId)}/feedback`,
        {
          analyst_id: 'Analyst',
          label,
          reasoning: `Analyst selected: ${title}`,
        }
      );

      setDetails((current) =>
        current
          ? {
              ...current,
              case: {
                ...(current.case ?? { case_id: caseId }),
                status: 'closed',
                feedback_label: label,
              },
            }
          : current
      );
      setFeedbackMessage(response.data.message ?? `Feedback saved: ${title}.`);
    } catch (error) {
      setFeedbackError(`Could not save analyst feedback: ${formatError(error)}`);
    } finally {
      setSubmittingLabel(null);
    }
  };

  if (!transactionId) {
    return (
      <div className="w-full min-h-[180px] flex flex-col items-center justify-center text-center rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <h2 className="text-xl font-semibold text-slate-100">
          Select a transaction to investigate
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Open a transaction from the Transaction Explorer to review its details
          and submit analyst feedback.
        </p>

        <Link
          to="/transactions"
          className="mt-3 inline-flex items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20"
        >
          Go to Transaction Explorer
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div role="status" className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
        Loading transaction and investigation details…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Could not load transaction details: {loadError}
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!details) return null;

  const { transaction, risk_signals: signals, related_entities: entities, case: investigationCase } = details;
  const amount = transaction.amount === null
    ? 'Not available'
    : new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 2,
      }).format(transaction.amount);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">
            Case Investigation: {transaction.transaction_id}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {transaction.model_version
              ? `Evaluated by ${transaction.model_version}`
              : 'Transaction and risk details from the live backend'}
            {investigationCase ? ` • Case ${investigationCase.case_id} (${investigationCase.status ?? 'open'})` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {feedbackActions.map(({ label, title, className, Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => void submitFeedback(label, title)}
              disabled={submittingLabel !== null || investigationCase?.status === 'closed'}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
            >
              <Icon size={16} />
              {submittingLabel === label ? 'Saving…' : title}
            </button>
          ))}
        </div>
      </div>

      {feedbackMessage && (
        <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {feedbackMessage}
        </div>
      )}
      {feedbackError && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {feedbackError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-slate-200">Transaction Details</h3>
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <span className="block text-slate-400">Amount</span>
                <span className="text-xl font-bold text-slate-100">{amount}</span>
              </div>
              <div>
                <span className="block text-slate-400">Transaction Type</span>
                <span className="font-medium text-slate-200">{transaction.type ?? 'Not available'}</span>
              </div>
              <div>
                <span className="block text-slate-400">Timestamp</span>
                <span className="font-medium text-slate-200">
                  {transaction.timestamp ? new Date(transaction.timestamp).toLocaleString() : 'Not available'}
                </span>
              </div>
              <div>
                <span className="block text-slate-400">Risk Score / Decision</span>
                <span className="font-medium text-slate-200">
                  {transaction.risk_score ?? 'Not available'}
                  {transaction.decision ? ` • ${transaction.decision}` : ''}
                </span>
              </div>
              <div>
                <span className="block text-slate-400">Source Account</span>
                <span className="font-medium text-cyan-400">{transaction.account_id ?? 'Not available'}</span>
              </div>
              <div>
                <span className="block text-slate-400">Recorded Label</span>
                <span className="font-medium text-slate-200">
                  {transaction.label === null ? 'Not labeled' : String(transaction.label)}
                </span>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-slate-200">Risk Signals &amp; Explanations</h3>
            {signals.length ? (
              <div className="space-y-3">
                {signals.map((signal, index) => {
                  const name = typeof signal === 'string' ? signal : signal.name ?? 'Risk signal';
                  const description = typeof signal === 'string'
                    ? signal
                    : signal.description ?? 'Additional signal metadata is not available.';
                  return (
                    <div
                      key={`${name}-${index}`}
                      className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3"
                    >
                      <AlertTriangle className="mt-0.5 shrink-0 text-amber-400" size={18} />
                      <div>
                        <h4 className="text-sm font-semibold text-amber-300">{name}</h4>
                        <p className="mt-1 text-xs text-slate-300">{description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No stored risk signals are available for this transaction.</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-slate-200">Related Entities</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3 text-slate-300">
                <User size={18} className="mt-0.5 shrink-0 text-cyan-400" />
                <div>
                  <span className="block text-slate-400">Account</span>
                  <span>{displayEntityId(entities.account)}</span>
                </div>
              </div>
              <div className="flex items-start gap-3 text-slate-300">
                <Monitor size={18} className="mt-0.5 shrink-0 text-cyan-400" />
                <div>
                  <span className="block text-slate-400">Device</span>
                  <span>{displayEntityId(entities.device)}</span>
                </div>
              </div>
              <div className="flex items-start gap-3 text-slate-300">
                <Clock size={18} className="mt-0.5 shrink-0 text-cyan-400" />
                <div>
                  <span className="block text-slate-400">Session</span>
                  <span>{displayEntityId(entities.session)}</span>
                </div>
              </div>
              {investigationCase?.feedback_label && (
                <div className="border-t border-slate-800 pt-3 text-xs text-slate-400">
                  Saved analyst label: {investigationCase.feedback_label}
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
