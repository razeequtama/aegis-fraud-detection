import React, { useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Search,
  ShieldAlert,
  Network,
  Sliders,
  Cpu,
  Activity,
  X,
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useLanguage, useTranslation } from '../i18n/LanguageContext';
import { CircleFlagEn, CircleFlagId } from './CircleFlags';
import { type Language } from '../i18n/types';

export interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleSelectLanguage = (lang: Language) => {
    setLanguage(lang);
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem('aegis_welcome_dismissed', 'true');
    } catch {
      // storage unavailable
    }
    onClose();
  };

  const moduleCards = [
    {
      key: 'dashboard',
      icon: LayoutDashboard,
      color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
      title: t.welcomeModal.pages.dashboard.title,
      desc: t.welcomeModal.pages.dashboard.desc,
      route: '/',
    },
    {
      key: 'transactions',
      icon: Search,
      color: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
      title: t.welcomeModal.pages.transactions.title,
      desc: t.welcomeModal.pages.transactions.desc,
      route: '/transactions',
    },
    {
      key: 'investigation',
      icon: ShieldAlert,
      color: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
      title: t.welcomeModal.pages.investigation.title,
      desc: t.welcomeModal.pages.investigation.desc,
      route: '/investigation',
    },
    {
      key: 'network',
      icon: Network,
      color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
      title: t.welcomeModal.pages.network.title,
      desc: t.welcomeModal.pages.network.desc,
      route: '/network',
    },
    {
      key: 'assessment',
      icon: Sliders,
      color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      title: t.welcomeModal.pages.assessment.title,
      desc: t.welcomeModal.pages.assessment.desc,
      route: '/assessment',
    },
    {
      key: 'modelLab',
      icon: Cpu,
      color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
      title: t.welcomeModal.pages.modelLab.title,
      desc: t.welcomeModal.pages.modelLab.desc,
      route: '/model-lab',
    },
    {
      key: 'systemHealth',
      icon: Activity,
      color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      title: t.welcomeModal.pages.systemHealth.title,
      desc: t.welcomeModal.pages.systemHealth.desc,
      route: '/health',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
    >
      {/* Backdrop with rich blur */}
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity animate-fade-in"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Modal Dialog Box */}
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl shadow-cyan-950/50 backdrop-blur-xl overflow-hidden z-10 animate-scale-in">
        {/* Glow ambient background effects */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-800/80 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4">
            {/* Aegis Crest Shield Logo */}
            <div className="relative shrink-0 flex items-center justify-center p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 via-blue-600/20 to-slate-900 border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
              <img
                src="/logo.svg"
                alt="AEGIS Crest Logo"
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain filter drop-shadow-[0_2px_10px_rgba(6,182,212,0.5)]"
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-mono uppercase tracking-[0.2em] text-cyan-400 font-semibold flex items-center gap-1.5">
                  <Sparkles size={13} className="text-cyan-400" />
                  {t.welcomeModal.badge}
                </span>
              </div>
              <h1
                id="welcome-modal-title"
                className="mt-0.5 text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-white flex items-center gap-2.5"
              >
                <span>{t.welcomeModal.title}</span>
                <span
                  className="font-display tracking-[0.16em] aegis-text-gradient aegis-glow font-black text-transparent bg-clip-text"
                  style={{
                    backgroundImage:
                      'linear-gradient(to top, #1e40af 0%, #0284c7 35%, #06b6d4 70%, #67e8f9 100%)',
                  }}
                >
                  AEGIS
                </span>
              </h1>
              <p className="text-sm text-slate-300 font-medium">
                {t.welcomeModal.tagline}
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 p-2 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-400 hover:text-white hover:border-slate-600 hover:bg-slate-700 active:scale-95 transition-all"
            aria-label={t.welcomeModal.closeTooltip}
            title={t.welcomeModal.closeTooltip}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-7 space-y-6">
          {/* Language Selection Bar (Prominent in Modal) */}
          <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900/90 to-blue-950/40 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <span className="text-xs sm:text-sm font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                  LANGUAGE PREFERENCE
                </span>
                <h3 className="text-base font-semibold text-slate-100">
                  {t.welcomeModal.chooseLanguage}
                </h3>
              </div>
              <span className="text-xs sm:text-sm text-slate-300 sm:text-right max-w-xs">
                {t.welcomeModal.chooseLanguageHint}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* English Option */}
              <button
                type="button"
                onClick={() => handleSelectLanguage('en')}
                className={`relative flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-200 active:scale-[0.99] ${
                  language === 'en'
                    ? 'border-cyan-400 bg-cyan-500/15 text-white ring-2 ring-cyan-500/40 shadow-lg shadow-cyan-500/10'
                    : 'border-slate-700/80 bg-slate-950/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0 p-1 rounded-full bg-slate-900/80 border border-slate-700 shadow-sm">
                    <CircleFlagEn size={26} />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-slate-100">English</span>
                    <span className="block text-xs sm:text-sm text-slate-300">Default International (EN)</span>
                  </div>
                </div>
                {language === 'en' && (
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-cyan-500 text-slate-950 shadow-sm">
                    <Check size={14} className="stroke-[3]" />
                  </span>
                )}
              </button>

              {/* Indonesian Option */}
              <button
                type="button"
                onClick={() => handleSelectLanguage('id')}
                className={`relative flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-200 active:scale-[0.99] ${
                  language === 'id'
                    ? 'border-cyan-400 bg-cyan-500/15 text-white ring-2 ring-cyan-500/40 shadow-lg shadow-cyan-500/10'
                    : 'border-slate-700/80 bg-slate-950/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0 p-1 rounded-full bg-slate-900/80 border border-slate-700 shadow-sm">
                    <CircleFlagId size={26} />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-slate-100">Bahasa Indonesia</span>
                    <span className="block text-xs sm:text-sm text-slate-300">Indonesian Localization (ID)</span>
                  </div>
                </div>
                {language === 'id' && (
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-cyan-500 text-slate-950 shadow-sm">
                    <Check size={14} className="stroke-[3]" />
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* What is Aegis? Overview Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 space-y-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-cyan-400" />
              <h3 className="font-display text-base font-bold text-slate-100">
                {t.welcomeModal.aboutTitle}
              </h3>
            </div>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
              {t.welcomeModal.aboutDescription}
            </p>
          </div>

          {/* Platform Architecture & Core Modules */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="font-display text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <Sparkles size={16} className="text-cyan-400" />
                {t.welcomeModal.modulesTitle}
              </h3>
              <span className="text-xs sm:text-sm text-slate-300">7 Connected Intelligence Modules</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {moduleCards.map((module) => {
                const Icon = module.icon;
                return (
                  <div
                    key={module.key}
                    className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-800/90 bg-slate-950/50 hover:bg-slate-800/40 hover:border-slate-700 transition-all duration-150"
                  >
                    <div className={`shrink-0 p-2 rounded-lg border ${module.color}`}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-200">
                        {module.title}
                      </h4>
                      <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {module.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 sm:px-8 border-t border-slate-800/80 bg-slate-900/90 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <span className="text-sm text-slate-300 text-center sm:text-left">
            {language === 'en'
              ? 'Click below to enter the live command console.'
              : 'Klik di bawah untuk masuk ke konsol kendali langsung.'}
          </span>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <span>{t.welcomeModal.getStartedBtn}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

