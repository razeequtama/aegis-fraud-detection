import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';

export const Network: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        { data: { id: 'acc1', label: 'ACC-105 (Suspicious)' } },
        { data: { id: 'dev1', label: 'DEV-021 (Shared)' } },
        { data: { id: 'acc2', label: 'ACC-202' } },
        { data: { id: 'acc3', label: 'ACC-310' } },
        { data: { source: 'acc1', target: 'dev1', id: 'e1' } },
        { data: { source: 'acc2', target: 'dev1', id: 'e2' } },
        { data: { source: 'acc3', target: 'dev1', id: 'e3' } },
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#06b6d4',
            'label': 'data(label)',
            'color': '#cbd5e1',
            'font-size': '12px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#334155',
            'target-arrow-color': '#334155',
            'target-arrow-shape': 'triangle',
          },
        },
      ],
      layout: {
        name: 'grid',
        rows: 2,
      },
    });

    return () => {
      cy.destroy();
    };
  }, []);

  return (
    <div className="space-y-6 h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Network Investigation</h2>
          <p className="text-xs text-slate-400 mt-1">Explore device-sharing clusters and coordinated fraud rings via NetworkX graph data</p>
        </div>
      </div>
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden relative">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
};