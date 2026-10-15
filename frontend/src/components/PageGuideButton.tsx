import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { PageGuideModal, type PageKey } from './PageGuideModal';
import { useTranslation } from '../i18n/LanguageContext';

export interface PageGuideButtonProps {
  page: PageKey;
  className?: string;
}

export const PageGuideButton: React.FC<PageGuideButtonProps> = ({
  page,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title={t.pageGuides.buttonTooltip}
        aria-label={t.pageGuides.buttonTooltip}
        className={`group flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl border border-cyan-500/30 bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 hover:border-cyan-400/60 shadow-sm shadow-cyan-950/20 active:scale-95 transition-all duration-200 shrink-0 text-xs sm:text-sm font-semibold cursor-pointer ${className}`}
      >
        <HelpCircle
          size={16}
          className="text-cyan-400 group-hover:scale-110 transition-transform duration-200"
        />
        <span className="hidden sm:inline font-sans">{t.pageGuides.buttonLabel}</span>
      </button>

      <PageGuideModal
        pageKey={page}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
};

