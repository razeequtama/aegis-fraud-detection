import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Search, ShieldAlert, Network, Sliders, Cpu, Activity } from 'lucide-react';

export const Layout: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Command Center', icon: LayoutDashboard },
    { path: '/transactions', label: 'Transaction Explorer', icon: Search },
    { path: '/investigation', label: 'Investigation', icon: ShieldAlert },
    { path: '/network', label: 'Network Graph', icon: Network },
    { path: '/assessment', label: 'Risk Assessment', icon: Sliders },
    { path: '/model-lab', label: 'Model Lab', icon: Cpu },
    { path: '/health', label: 'System Health', icon: Activity },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold tracking-wider text-cyan-400">AEGIS</h1>
          <p className="text-xs text-slate-400 mt-1">Fraud Detection Platform</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8">
          <span className="text-sm font-medium text-slate-400">Operational Risk & Intelligence</span>
        </header>
        <div className="flex-1 overflow-y-auto p-8 bg-slate-950">
          <Outlet />
        </div>
      </main>
    </div>
  );
};