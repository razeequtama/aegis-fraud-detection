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
  HelpCircle,
} from 'lucide-react';
import { AegisWordmark } from './AegisWordmark';
import { LanguageSwitcher } from './LanguageSwitcher';
import { WelcomeModal } from './WelcomeModal';
import { useTranslation } from '../i18n/LanguageContext';

export const Layout: React.FC = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(() => {
    try {
      return localStorage.getItem('aegis_welcome_dismissed') !== 'true';
    } catch {
      return false;
    }
  });
  const { t } = useTranslation();

  const navItems = [
    { path: '/', label: t.nav.commandCenter, icon: LayoutDashboard },
    { path: '/transactions', label: t.nav.transactionExplorer, icon: Search },
    { path: '/investigation', label: t.nav.investigation, icon: ShieldAlert },
    { path: '/network', label: t.nav.network, icon: Network },
    { path: '/assessment', label: t.nav.riskAssessment, icon: Sliders },
    { path: '/model-lab', label: t.nav.modelLab, icon: Cpu },
    { path: '/health', label: t.nav.systemHealth, icon: Activity },
  ];

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Auto-close mobile drawer and scroll to top on route transition
  useEffect(() => {
    setMobileMenuOpen(false);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
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
          <AegisWordmark size="lg" withLogo showSubtitle asLink />
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
                className={`group flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98] ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white hover:border-slate-700/60 border border-transparent'
                }`}
              >
                <Icon
                  size={19}
                  className={`transition-all duration-200 ease-out ${
                    isActive
                      ? 'text-cyan-400 scale-105'
                      : 'text-slate-400 group-hover:text-cyan-300 group-hover:scale-110'
                  }`}
                />
                <span className="transition-colors duration-150">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Platform Guide Button in Desktop Sidebar */}
        <div className="p-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setWelcomeOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-slate-700/80 bg-slate-950/60 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-slate-800/80 active:scale-[0.98] transition-all text-xs font-semibold group shadow-sm"
          >
            <span className="flex items-center gap-2">
              <HelpCircle size={15} className="text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>{t.welcomeModal.reopenGuide}</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
              INFO
            </span>
          </button>
        </div>

        {/* Language Switcher in Desktop Sidebar */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/60">
          <span className="text-xs text-slate-400 font-medium">{t.common.language}</span>
          <LanguageSwitcher size="sm" />
        </div>
      </aside>

      {/* Mobile / Tablet Drawer Menu with Smooth Sliding Transition */}
      <div
        className={`fixed inset-0 z-50 lg:hidden flex transition-all duration-300 ease-in-out ${
          mobileMenuOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none delay-300'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        {/* Backdrop overlay with fade */}
        <div
          className={`fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
            mobileMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Drawer content with smooth slide-in and slide-out */}
        <aside
          className={`relative flex flex-col w-72 max-w-[85vw] h-full bg-slate-900 border-r border-slate-800 shadow-2xl z-10 transition-transform duration-300 ease-out transform ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <AegisWordmark size="md" withLogo showSubtitle asLink />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-slate-600 active:scale-95 transition-all duration-150"
              aria-label={t.common.closeMenu}
            >
              <X size={19} />
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
                  className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98] ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white hover:border-slate-700/60 border border-transparent'
                  }`}
                >
                  <Icon
                    size={19}
                    className={`transition-all duration-200 ease-out ${
                      isActive
                        ? 'text-cyan-400 scale-105'
                        : 'text-slate-400 group-hover:text-cyan-300 group-hover:scale-110'
                    }`}
                  />
                  <span className="transition-colors duration-150">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Platform Guide Button in Mobile Drawer */}
          <div className="p-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setWelcomeOpen(true);
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-slate-700/80 bg-slate-950/60 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-slate-800/80 active:scale-[0.98] transition-all text-xs font-semibold group shadow-sm"
            >
              <span className="flex items-center gap-2">
                <HelpCircle size={15} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>{t.welcomeModal.reopenGuide}</span>
              </span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                INFO
              </span>
            </button>
          </div>

          {/* Language Switcher in Mobile Drawer */}
          <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/60">
            <span className="text-xs text-slate-400 font-medium">{t.common.language}</span>
            <LanguageSwitcher size="sm" />
          </div>
        </aside>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile / Tablet Top Header Bar (hidden on lg screens) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <AegisWordmark size="sm" withLogo asLink />
            <span className="text-slate-600">/</span>
            <span className="text-xs sm:text-sm font-sans font-medium text-slate-200 truncate">
              {currentNav?.label ?? t.nav.commandCenter}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWelcomeOpen(true)}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 active:scale-95 transition-all duration-150"
              aria-label={t.welcomeModal.reopenGuide}
              title={t.welcomeModal.reopenGuide}
            >
              <HelpCircle size={18} />
            </button>
            <LanguageSwitcher size="sm" />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:text-cyan-400 hover:border-cyan-500/40 active:scale-95 transition-all duration-150"
              aria-label={t.common.openMenu}
            >
              <Menu size={20} />
            </button>
          </div>
        </header>

        {/* Scrollable page body with responsive padding and fluid page transition */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950">
          <div key={location.pathname} className="page-transition min-h-full">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Welcome & Platform Guide Modal */}
      <WelcomeModal isOpen={welcomeOpen} onClose={() => setWelcomeOpen(false)} />
    </div>
  );
};