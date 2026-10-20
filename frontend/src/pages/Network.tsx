import { useEffect, useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import cytoscape from 'cytoscape';
import type { Core, ElementDefinition } from 'cytoscape';
import {
  AlertTriangle,
  ArrowRight,
  LoaderCircle,
  Search,
  Sparkles,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { AegisWordmark } from '../components/AegisWordmark';
import { PageGuideButton } from '../components/PageGuideButton';
import { useTranslation } from '../i18n/LanguageContext';

type EntityType = 'transactions' | 'accounts';

export interface NetworkPreset {
  id: string;
  type: EntityType;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  stats: string;
}

const networkPresets: NetworkPreset[] = [
  {
    id: 'C376938867',
    type: 'accounts',
    title: '53-Account Fraud Ring',
    badge: 'Syndicate Ring',
    badgeColor: 'border-cyan-400/60 bg-cyan-500/25 text-cyan-100 font-bold',
    description: 'Shared emulator (DEV-SIM-995) links 53 accounts with 17 flagged fraud nodes.',
    stats: '56 Nodes · 17 Suspicious · 1 Shared Device',
  },
  {
    id: 'C1387708046',
    type: 'accounts',
    title: 'High-Density Device Ring',
    badge: 'Device Multiplexing',
    badgeColor: 'border-cyan-600/40 bg-cyan-950/60 text-cyan-300 font-medium',
    description: 'Shared device DEV-SIM-236 links 54 accounts with 19 confirmed fraud nodes.',
    stats: '57 Nodes · 19 Suspicious · 1 Shared Device',
  },
  {
    id: 'TX-100463',
    type: 'transactions',
    title: 'Fraudulent Syndicate Transfer',
    badge: 'Flagged Transaction',
    badgeColor: 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200 font-semibold',
    description: 'Syndicate transfer executed within the DEV-SIM-995 multi-account ring.',
    stats: 'Linked to C376938867 & DEV-SIM-995',
  },
  {
    id: 'C1791470904',
    type: 'accounts',
    title: 'Mule Account Network',
    badge: 'Mule Ring',
    badgeColor: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300 font-semibold',
    description: 'Device DEV-SIM-278 connecting 47 accounts with multiple concurrent cash-outs.',
    stats: '50 Nodes · 17 Suspicious · 1 Shared Device',
  },
  {
    id: 'TX-140135',
    type: 'transactions',
    title: 'High-Value Drain (Rp 3M)',
    badge: 'Decline Cluster',
    badgeColor: 'border-cyan-400/60 bg-cyan-500/25 text-cyan-100 font-bold',
    description: 'Critical Rp 2,988,103 cash out on device DEV-SIM-360 with decline score 0.99.',
    stats: 'Score 0.99 · 100% Drain · DEV-SIM-360',
  },
  {
    id: 'C1041698296',
    type: 'accounts',
    title: 'Clean Retail Customer',
    badge: 'Normal Baseline',
    badgeColor: 'border-slate-700 bg-slate-800/80 text-slate-300 font-medium',
    description: 'Standard retail customer with normal transactions and zero fraud flags.',
    stats: 'Legitimate Baseline · Low Risk',
  },
];

interface GraphNode {
  id: string;
  label: string;
  type?: string;
  suspicious?: boolean;
  shared?: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  relation?: string;
}

interface GraphResponse {
  center_node: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  metrics?: {
    degree: number;
    neighborhood_size: number;
  };
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    return typeof detail === 'string' ? detail : error.message;
  }
  return error instanceof Error ? error.message : 'Unable to load network data.';
}

export const Network: React.FC = () => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Core | null>(null);
  const navigate = useNavigate();
  const { entityType: routeEntityType, entityId: routeEntityId } = useParams<{
    entityType: string;
    entityId: string;
  }>();
  const [entityType, setEntityType] = useState<EntityType>(
    routeEntityType === 'accounts' ? 'accounts' : 'transactions'
  );
  const [entityId, setEntityId] = useState(routeEntityId ?? '');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [graphSummary, setGraphSummary] = useState<GraphResponse | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [presets, setPresets] = useState<NetworkPreset[]>(networkPresets);

  const localizedPresetMap: Record<
    string,
    { title: string; badge: string; description: string; stats: string }
  > = {
    C376938867: {
      title: t.network.presetRing1Title,
      badge: t.network.badgeSyndicate,
      description: t.network.presetRing1Desc,
      stats: t.network.presetRing1Stats,
    },
    C1387708046: {
      title: t.network.presetRing2Title,
      badge: t.network.badgeDevice,
      description: t.network.presetRing2Desc,
      stats: t.network.presetRing2Stats,
    },
    'TX-100463': {
      title: t.network.presetRing3Title,
      badge: t.network.badgeFlagged,
      description: t.network.presetRing3Desc,
      stats: t.network.presetRing3Stats,
    },
    C1791470904: {
      title: t.network.presetRing4Title,
      badge: t.network.badgeMule,
      description: t.network.presetRing4Desc,
      stats: t.network.presetRing4Stats,
    },
    'TX-140135': {
      title: t.network.presetRing5Title,
      badge: t.network.badgeDecline,
      description: t.network.presetRing5Desc,
      stats: t.network.presetRing5Stats,
    },
    C1041698296: {
      title: t.network.presetRing6Title,
      badge: t.network.badgeNormal,
      description: t.network.presetRing6Desc,
      stats: t.network.presetRing6Stats,
    },
  };

  useEffect(() => {
    let active = true;
    apiClient
      .get<
        Array<{
          id: string;
          type: EntityType;
          title: string;
          badge: string;
          badge_color?: string;
          badgeColor?: string;
          description: string;
          stats: string;
        }>
      >('/network/presets')
      .then((res) => {
        if (!active || !Array.isArray(res.data) || res.data.length === 0) return;
        const colorMap: Record<string, string> = {
          rose: 'border-cyan-400/60 bg-cyan-500/25 text-cyan-100 font-bold',
          amber: 'border-cyan-600/40 bg-cyan-950/60 text-cyan-300 font-medium',
          purple: 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200 font-semibold',
          emerald: 'border-slate-700 bg-slate-800/80 text-slate-300 font-medium',
        };
        const loaded: NetworkPreset[] = res.data.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          badge: item.badge,
          badgeColor:
            item.badgeColor ||
            (item.badge_color && colorMap[item.badge_color]
              ? colorMap[item.badge_color]
              : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'),
          description: item.description,
          stats: item.stats,
        }));
        setPresets(loaded);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Adjust state on route transition without cascading effect
  const [prevRouteType, setPrevRouteType] = useState(routeEntityType);
  const [prevRouteId, setPrevRouteId] = useState(routeEntityId);

  if (prevRouteType !== routeEntityType || prevRouteId !== routeEntityId) {
    setPrevRouteType(routeEntityType);
    setPrevRouteId(routeEntityId);
    if (routeEntityType === 'accounts' || routeEntityType === 'transactions') {
      setEntityType(routeEntityType);
    }
    if (routeEntityId !== undefined) {
      setEntityId(routeEntityId);
    }
  }

  const handleSelectPreset = (preset: NetworkPreset) => {
    setEntityType(preset.type);
    setEntityId(preset.id);
    setErrorMessage(null);
    navigate(`/network/${preset.type}/${encodeURIComponent(preset.id)}`);
  };
  const requestedType: EntityType | null =
    routeEntityType === 'transactions' || routeEntityType === 'accounts'
      ? routeEntityType
      : null;
  const requestedId = routeEntityId ?? '';
  const loadRequest =
    requestedType && requestedId ? { type: requestedType, id: requestedId } : null;
  const routeError =
    routeEntityType && !requestedType
      ? t.network.chooseEntityError
      : null;

  useEffect(() => {
    if (!requestedType || !requestedId || !containerRef.current) return;

    const controller = new AbortController();
    const targetType = requestedType;
    const targetId = requestedId;
    const loadGraph = async () => {
      setLoading(true);
      setErrorMessage(null);
      setGraphSummary(null);
      try {
        const response = await apiClient.get<GraphResponse>(
          `/${targetType}/${encodeURIComponent(targetId)}/network`,
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;

        const { nodes, edges } = response.data;
        const elements: ElementDefinition[] = [
          ...nodes.map((node) => ({
            data: {
              id: node.id,
              label: node.label,
              type: node.type ?? node.id.split(':', 1)[0].toLowerCase(),
              suspicious: Boolean(node.suspicious),
              shared: Boolean(node.shared),
            },
          })),
          ...edges.map((edge) => ({
            data: {
              id: `${edge.source}->${edge.target}`,
              source: edge.source,
              target: edge.target,
              relation: edge.relation ?? 'connected',
            },
          })),
        ];

        graphRef.current?.destroy();
        graphRef.current = cytoscape({
          container: containerRef.current,
          elements,
          style: [
            {
              selector: 'node',
              style: {
                'background-color': '#0891b2',
                'border-color': '#67e8f9',
                'border-width': '1px',
                label: 'data(label)',
                color: '#cbd5e1',
                'font-size': 11,
                'text-valign': 'bottom',
                'text-margin-y': 7,
                'text-wrap': 'wrap',
                'text-max-width': 130,
                width: '34px',
                height: '34px',
              } as Record<string, string | number>,
            },
            {
              selector: 'node[type = "account"]',
              style: {
                shape: 'ellipse',
                'background-color': '#0369a1',
                'border-color': '#38bdf8',
                'border-width': '1.5px',
              } as Record<string, string | number>,
            },
            {
              selector: 'node[type = "account"][suspicious = true]',
              style: {
                'background-color': '#22d3ee',
                'border-color': '#ecfeff',
                'border-width': '3px',
              } as Record<string, string | number>,
            },
            {
              selector: 'node[type = "device"]',
              style: {
                shape: 'round-rectangle',
                'background-color': '#0891b2',
                'border-color': '#67e8f9',
              } as Record<string, string | number>,
            },
            {
              selector: 'node[type = "device"][shared = true]',
              style: {
                'background-color': '#06b6d4',
                'border-color': '#a5f3fc',
                'border-width': '3px',
              } as Record<string, string | number>,
            },
            {
              selector: 'node[type = "session"]',
              style: {
                shape: 'diamond',
                'background-color': '#475569',
                'border-color': '#94a3b8',
              } as Record<string, string | number>,
            },
            {
              selector: 'node[type = "transaction"]',
              style: {
                shape: 'hexagon',
                'background-color': '#0e7490',
                'border-color': '#67e8f9',
                'border-width': '2px',
              } as Record<string, string | number>,
            },
            {
              selector: 'edge',
              style: {
                width: '2px',
                'line-color': '#475569',
                'target-arrow-color': '#64748b',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                label: 'data(relation)',
                color: '#94a3b8',
                'font-size': '8px',
                'text-background-color': '#0f172a',
                'text-background-opacity': 0.85,
                'text-background-padding': '2px',
              } as Record<string, string | number>,
            },
          ],
          layout: {
            name: 'cose',
            animate: false,
            padding: 36,
          },
          minZoom: 0.3,
          maxZoom: 2.5,
          wheelSensitivity: 0.25,
        });
        setGraphSummary(response.data);
      } catch (error) {
        if (!controller.signal.aborted) setErrorMessage(getErrorMessage(error));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadGraph();
    return () => {
      controller.abort();
      graphRef.current?.destroy();
      graphRef.current = null;
    };
  }, [requestedId, requestedType, retryCount]);

  const handleClear = () => {
    setEntityId('');
    setErrorMessage(null);
    setGraphSummary(null);
    navigate('/network');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedId = entityId.trim();
    if (!normalizedId) {
      setErrorMessage(t.network.enterIdError);
      return;
    }
    setErrorMessage(null);
    navigate(`/network/${entityType}/${encodeURIComponent(normalizedId)}`);
  };

  return (
    <div className="flex flex-col space-y-4 min-h-[600px] lg:h-[calc(100vh-140px)]">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center border-b border-slate-800/60 pb-4">
        <div className="max-w-xl">
          <span className="text-xs sm:text-sm font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
            <AegisWordmark size="xs" inline />{t.network.tag}
          </span>
          <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-slate-100 mt-1">
            {t.network.title}
          </h2>
          <p className="mt-1 text-sm sm:text-base text-slate-300">
            {t.network.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-nowrap">
          <form onSubmit={handleSubmit} className="flex items-center gap-2 shrink-0 flex-nowrap">
            <label htmlFor="network-entity-type" className="sr-only">
              Network entity type
            </label>
            <select
              id="network-entity-type"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value as EntityType)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none interactive-input shrink-0"
            >
              <option value="transactions">{t.network.transactionOption}</option>
              <option value="accounts">{t.network.accountOption}</option>
            </select>
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="network-entity-id" className="sr-only">
                Transaction or account ID
              </label>
              <input
                id="network-entity-id"
                value={entityId}
                onChange={(event) => setEntityId(event.target.value)}
                placeholder={entityType === 'transactions' ? t.network.txIdPlaceholder : t.network.accIdPlaceholder}
                className="w-40 sm:w-48 md:w-56 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none interactive-input font-mono"
              />
              <button
                type="submit"
                className="shrink-0 flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 active:scale-[0.98] transition-all whitespace-nowrap interactive-btn"
              >
                <Search size={16} />
                {t.network.exploreBtn}
              </button>
            </div>
          </form>
          <PageGuideButton page="network" className="shrink-0" />
        </div>
      </div>

      {/* Pattern Showcase Quick-Select Pills (Horizontally scrollable on mobile) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full sm:flex-wrap">
        <span className="shrink-0 text-sm font-semibold uppercase tracking-wider text-slate-300 mr-1">
          {t.network.patternPresets}
        </span>
        {presets.map((preset) => {
          const isActive = requestedId === preset.id && requestedType === preset.type;
          const loc = localizedPresetMap[preset.id];
          const title = loc?.title || preset.title;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className={`shrink-0 whitespace-nowrap flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all interactive-btn ${
                isActive
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-sm shadow-cyan-500/20 ring-1 ring-cyan-400/40'
                  : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
              }`}
            >
              <span>{title}</span>
              <span
                className={`rounded px-2.5 py-0.5 text-xs sm:text-sm font-semibold border ${preset.badgeColor}`}
              >
                {preset.type === 'accounts' ? t.network.accountOption : 'TX'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative min-h-[440px] lg:min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />
        {!loadRequest && !loading && (
          <div className="absolute inset-0 z-10 overflow-y-auto bg-slate-950/85 p-6 backdrop-blur-sm animate-fade-in">
            <div className="mx-auto max-w-5xl space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-sm font-medium text-cyan-300">
                  <Sparkles size={14} />
                  {t.network.dbPatternShowcase}
                </div>
                <h3 className="mt-2 text-xl sm:text-2xl font-display font-bold tracking-tight text-slate-100">
                  {t.network.choosePatternTitle}
                </h3>
                <p className="mx-auto mt-1 max-w-2xl text-sm sm:text-base text-slate-300">
                  {t.network.choosePatternDesc}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {presets.map((preset) => {
                  const loc = localizedPresetMap[preset.id];
                  const title = loc?.title || preset.title;
                  const badge = loc?.badge || preset.badge;
                  const desc = loc?.description || preset.description;
                  const stats = loc?.stats || preset.stats;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="interactive-card group flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/90 p-4 text-left transition-all hover:border-cyan-500/50 hover:bg-slate-800/80 hover:shadow-lg hover:shadow-cyan-500/10"
                    >
                      <div>
                        <div className="mb-2.5 flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs sm:text-sm font-semibold ${preset.badgeColor}`}
                          >
                            {badge}
                          </span>
                          <span className="font-mono text-sm text-slate-300 group-hover:text-cyan-300">
                            {preset.type === 'accounts' ? t.network.accountOption : t.network.transactionOption}
                          </span>
                        </div>
                        <h4 className="font-display text-base font-semibold tracking-tight text-slate-100 group-hover:text-cyan-200">
                          {title}
                        </h4>
                        <p className="mt-1 font-mono text-sm text-cyan-400">
                          {preset.id}
                        </p>
                        <p className="mt-2 text-sm text-slate-300 line-clamp-2">
                          {desc}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-sm">
                        <span className="font-medium text-slate-300">{stats}</span>
                        <span className="flex items-center gap-1 font-semibold text-cyan-400 transition-transform group-hover:translate-x-1">
                          {t.network.exploreBtn} <ArrowRight size={14} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 animate-fade-in">
            <div role="status" className="flex items-center gap-3 text-sm text-slate-300">
              <LoaderCircle className="animate-spin text-cyan-400" size={18} />
              {t.network.loadingGraph}
            </div>
          </div>
        )}
        {(errorMessage || routeError) && (
          <div className="animate-slide-down absolute left-4 right-4 top-4 z-20 flex items-start justify-between gap-4 rounded-lg border border-rose-500/30 bg-slate-950/95 p-4 text-sm text-rose-300 shadow-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 shrink-0" size={17} />
              <span role="alert">{errorMessage ?? routeError}</span>
            </div>
            {loadRequest && (
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="shrink-0 rounded border border-rose-500/30 px-3 py-1.5 text-sm font-semibold hover:bg-rose-500/10 interactive-btn"
              >
                {t.network.retry}
              </button>
            )}
          </div>
        )}
        {graphSummary && !loading && (
          <>
            <div className="animate-fade-in absolute left-4 top-4 z-10 flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/90 px-3.5 py-2 text-sm text-slate-200 shadow-md backdrop-blur-sm">
              <span>
                <strong className="text-cyan-300">{graphSummary.center_node}</strong> ·{' '}
                {graphSummary.metrics?.neighborhood_size ?? graphSummary.nodes.length} {t.network.nodesCount} ·{' '}
                {graphSummary.edges.length} {t.network.connectionsCount}
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="rounded border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-700 hover:text-white interactive-btn"
              >
                {t.network.clearView}
              </button>
            </div>
            <div className="animate-fade-in absolute bottom-4 right-4 z-10 space-y-2 rounded-lg border border-slate-700 bg-slate-950/90 p-3.5 text-sm text-slate-200">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-cyan-300 ring-2 ring-cyan-100" />
                {t.network.suspiciousAccount}
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-cyan-500" />
                {t.network.sharedDevice}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
