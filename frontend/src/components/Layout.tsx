import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  ShieldAlert,
  Network,
  Sliders,
  Cpu,
  Activity,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';

export const Layout: React.FC = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Command Center', icon: LayoutDashboard },
    { path: '/transactions', label: 'Transaction Explorer', icon: Search },
    { path: '/investigation', label: 'Investigation', icon: ShieldAlert },
    { path: '/network', label: 'Network Graph', icon: Network },
    { path: '/assessment', label: 'Risk Assessment', icon: Sliders },
    { path: '/model-lab', label: 'Model Lab', icon: Cpu },
    { path: '/health', label: 'System Health', icon: Activity },
  ];

  // Auto-close mobile drawer on route transition
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentNav = navItems.find((item) =>
    item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path)
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Desktop Sidebar (hidden on phone & tablet, visible on lg screens) */}
      <aside className="hidden lg:flex w-64 bg-slate-900 border-r border-slate-800 flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-cyan-400" size={24} />
            <h1 className="text-xl font-bold tracking-wider text-cyan-400">AEGIS</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">Fraud Detection Platform</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
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
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Engine: aegis-rf-0.1.0</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        </div>
      </aside>

      {/* Mobile / Tablet Drawer Menu Modal */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <aside className="relative flex flex-col w-72 max-w-[85vw] h-full bg-slate-900 border-r border-slate-800 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-cyan-400" size={22} />
                <div>
                  <h1 className="text-lg font-bold tracking-wider text-cyan-400">AEGIS</h1>
                  <p className="text-[10px] text-slate-400">Fraud Detection Platform</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200"
                aria-label="Close navigation menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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

            <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Engine: aegis-rf-0.1.0</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile / Tablet Top Header Bar (hidden on lg screens) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck className="text-cyan-400 shrink-0" size={20} />
            <span className="text-base font-bold tracking-wider text-cyan-400 shrink-0">
              AEGIS
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-medium text-slate-300 truncate">
              {currentNav?.label ?? 'Command Center'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
        </header>

        {/* Scrollable page body with responsive padding */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950">
          <Outlet />
        </div>
      </main>
    </div>
  );
};