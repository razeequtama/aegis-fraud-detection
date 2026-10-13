import { useEffect, useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import cytoscape from 'cytoscape';
import type { Core, ElementDefinition } from 'cytoscape';
import { AlertTriangle, LoaderCircle, Network as NetworkIcon, Search } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';

type EntityType = 'transactions' | 'accounts';

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
  const requestedType: EntityType | null =
    routeEntityType === 'transactions' || routeEntityType === 'accounts'
      ? routeEntityType
      : null;
  const requestedId = routeEntityId ?? '';
  const loadRequest =
    requestedType && requestedId ? { type: requestedType, id: requestedId } : null;
  const routeError =
    routeEntityType && !requestedType
      ? 'Choose a transaction or account network to explore.'
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
              } as any,
            },
            {
              selector: 'node[type = "account"]',
              style: {
                shape: 'ellipse',
                'background-color': '#0e7490',
              } as any,
            },
            {
              selector: 'node[type = "account"][suspicious = true]',
              style: {
                'background-color': '#e11d48',
                'border-color': '#fda4af',
                'border-width': '3px',
              } as any,
            },
            {
              selector: 'node[type = "device"]',
              style: {
                shape: 'round-rectangle',
                'background-color': '#0891b2',
                'border-color': '#67e8f9',
              } as any,
            },
            {
              selector: 'node[type = "device"][shared = true]',
              style: {
                'background-color': '#06b6d4',
                'border-color': '#a5f3fc',
                'border-width': '3px',
              } as any,
            },
            {
              selector: 'node[type = "session"]',
              style: {
                shape: 'diamond',
                'background-color': '#475569',
                'border-color': '#94a3b8',
              } as any,
            },
            {
              selector: 'node[type = "transaction"]',
              style: {
                shape: 'hexagon',
                'background-color': '#7c3aed',
                'border-color': '#c4b5fd',
              } as any,
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
              } as any,
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedId = entityId.trim();
    if (!normalizedId) {
      setErrorMessage('Enter an ID to load its network neighborhood.');
      return;
    }
    setErrorMessage(null);
    navigate(`/network/${entityType}/${encodeURIComponent(normalizedId)}`);
  };

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Network Investigation</h2>
          <p className="mt-1 text-xs text-slate-400">
            Explore connected accounts, shared devices, and transaction relationships.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
          <label htmlFor="network-entity-type" className="sr-only">
            Network entity type
          </label>
          <select
            id="network-entity-type"
            value={entityType}
            onChange={(event) => setEntityType(event.target.value as EntityType)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
          >
            <option value="transactions">Transaction</option>
            <option value="accounts">Account</option>
          </select>
          <label htmlFor="network-entity-id" className="sr-only">
            Transaction or account ID
          </label>
          <input
            id="network-entity-id"
            value={entityId}
            onChange={(event) => setEntityId(event.target.value)}
            placeholder={entityType === 'transactions' ? 'Transaction ID' : 'Account ID'}
            className="w-48 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20"
          >
            <Search size={16} />
            Explore
          </button>
        </form>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />
        {!loadRequest && !loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center text-slate-500">
              <NetworkIcon className="mx-auto mb-3 text-slate-600" size={36} />
              <p className="text-sm">Enter a transaction or account ID to explore its network.</p>
            </div>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70">
            <div role="status" className="flex items-center gap-3 text-sm text-slate-300">
              <LoaderCircle className="animate-spin text-cyan-400" size={18} />
              Loading NetworkX neighborhood…
            </div>
          </div>
        )}
        {(errorMessage || routeError) && (
          <div className="absolute left-4 right-4 top-4 z-20 flex items-start justify-between gap-4 rounded-lg border border-rose-500/30 bg-slate-950/95 p-4 text-sm text-rose-300 shadow-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 shrink-0" size={17} />
              <span role="alert">{errorMessage ?? routeError}</span>
            </div>
            {loadRequest && (
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="shrink-0 rounded border border-rose-500/30 px-3 py-1 text-xs font-semibold hover:bg-rose-500/10"
              >
                Retry
              </button>
            )}
          </div>
        )}
        {graphSummary && !loading && (
          <>
            <div className="absolute left-4 top-4 z-10 rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-xs text-slate-300">
              {graphSummary.center_node} · {graphSummary.metrics?.neighborhood_size ?? graphSummary.nodes.length} nodes ·{' '}
              {graphSummary.edges.length} connections
            </div>
            <div className="absolute bottom-4 right-4 z-10 space-y-2 rounded-lg border border-slate-700 bg-slate-950/90 p-3 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500" />
                Suspicious account
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-cyan-400" />
                Shared device
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
