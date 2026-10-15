import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  Compass,
  Cpu,
  ListOrdered,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

export type PageKey =
  | 'dashboard'
  | 'transactions'
  | 'investigation'
  | 'network'
  | 'assessment'
  | 'modelLab'
  | 'systemHealth';

export interface PageGuideModalProps {
  pageKey: PageKey;
  isOpen: boolean;
  onClose: () => void;
}

export const PageGuideModal: React.FC<PageGuideModalProps> = ({
  pageKey,
  isOpen,
  onClose,
}) => {
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

  const guide = t.pageGuides.pages[pageKey];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="page-guide-modal-title"
    >
      {/* Backdrop with rich blur */}
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Window */}
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl shadow-cyan-950/50 backdrop-blur-xl overflow-hidden z-10 animate-scale-in my-auto">
        {/* Glow ambient background effects */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative px-4 py-4 sm:px-8 sm:py-6 border-b border-slate-800/80 flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="relative shrink-0 flex items-center justify-center p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 via-blue-600/20 to-slate-900 border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
              <ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7 text-cyan-400" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.2em] text-cyan-400 font-semibold flex items-center gap-1.5 truncate">
                  <Sparkles size={12} className="text-cyan-400 shrink-0" />
                  <span className="truncate">{t.pageGuides.modalBadge} · {guide.badge}</span>
                </span>
              </div>
              <h2
                id="page-guide-modal-title"
                className="mt-0.5 text-lg sm:text-2xl font-display font-bold tracking-tight text-white truncate sm:text-wrap"
              >
                {guide.title}
              </h2>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 sm:p-2 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-400 hover:text-white hover:border-slate-600 hover:bg-slate-700 active:scale-95 transition-all"
            aria-label={t.pageGuides.closeTooltip}
            title={t.pageGuides.closeTooltip}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-7 space-y-4 sm:space-y-6">
          {/* Section 1: What is this page? */}
          <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/30 via-slate-900/90 to-slate-950 p-3.5 sm:p-5 space-y-2">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 shrink-0">
                <Compass size={17} />
              </div>
              <h3 className="font-display text-sm sm:text-base font-bold text-cyan-200">
                {t.pageGuides.sectionWhatIs}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed sm:pl-8">
              {guide.whatIs}
            </p>
          </div>

          {/* Section 2: How does it work? */}
          <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-950/30 via-slate-900/90 to-slate-950 p-3.5 sm:p-5 space-y-2">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 shrink-0">
                <Cpu size={17} />
              </div>
              <h3 className="font-display text-sm sm:text-base font-bold text-blue-200">
                {t.pageGuides.sectionHowItWorks}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed sm:pl-8">
              {guide.howItWorks}
            </p>
          </div>

          {/* Section 3: How to operate it? */}
          <div className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-3.5 sm:p-5 space-y-3 sm:space-y-3.5">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 shrink-0">
                <ListOrdered size={17} />
              </div>
              <h3 className="font-display text-sm sm:text-base font-bold text-slate-100">
                {t.pageGuides.sectionHowToOperate}
              </h3>
            </div>

            <div className="space-y-2 sm:space-y-2.5 sm:pl-2">
              {guide.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/50 hover:border-slate-700 transition-all duration-150"
                >
                  <span className="shrink-0 flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono text-[11px] sm:text-xs font-bold mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3.5 sm:px-8 sm:py-4 border-t border-slate-800/80 bg-slate-900/90 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-400 font-mono text-center sm:text-left">
            ESC to close · AEGIS Operating Manual
          </span>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 sm:px-6 sm:py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <span>{t.pageGuides.gotItBtn}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

