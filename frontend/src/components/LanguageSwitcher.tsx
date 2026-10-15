import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { CircleFlagEn, CircleFlagId } from './CircleFlags';

export interface LanguageSwitcherProps {
  /**
   * Presentation variant:
   * - 'pill': Segmented switch showing both circular flags side-by-side (recommended)
   * - 'compact': Single button toggling the active language with its circular flag
   */
  variant?: 'pill' | 'compact';
  className?: string;
  size?: 'sm' | 'md';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'pill',
  className = '',
  size = 'md',
}) => {
  const { language, setLanguage, t } = useLanguage();

  if (variant === 'compact') {
    const isEn = language === 'en';
    const nextLang = isEn ? 'id' : 'en';
    const nextTitle = isEn ? t.common.switchToIndonesian : t.common.switchToEnglish;

    return (
      <button
        type="button"
        onClick={() => setLanguage(nextLang)}
        title={nextTitle}
        aria-label={nextTitle}
        className={`group inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-850 hover:border-cyan-500/40 text-slate-200 transition-all duration-200 active:scale-95 shadow-sm ${className}`}
      >
        {isEn ? <CircleFlagEn size={18} /> : <CircleFlagId size={18} />}
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 group-hover:text-cyan-300">
          {language.toUpperCase()}
        </span>
      </button>
    );
  }

  const flagSize = size === 'sm' ? 16 : 18;
  const paddingClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <div
      role="group"
      aria-label={t.common.language}
      className={`inline-flex items-center p-1 rounded-lg bg-slate-900/90 border border-slate-800 shadow-inner ${className}`}
    >
      {/* English Option */}
      <button
        type="button"
        onClick={() => setLanguage('en')}
        title={t.common.switchToEnglish}
        aria-pressed={language === 'en'}
        className={`flex items-center gap-1.5 rounded-md font-medium transition-all duration-200 active:scale-95 select-none ${paddingClass} ${
          language === 'en'
            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10 font-bold'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent'
        }`}
      >
        <CircleFlagEn size={flagSize} />
        <span className="font-mono tracking-wide">EN</span>
      </button>

      {/* Indonesian Option */}
      <button
        type="button"
        onClick={() => setLanguage('id')}
        title={t.common.switchToIndonesian}
        aria-pressed={language === 'id'}
        className={`flex items-center gap-1.5 rounded-md font-medium transition-all duration-200 active:scale-95 select-none ${paddingClass} ${
          language === 'id'
            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10 font-bold'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent'
        }`}
      >
        <CircleFlagId size={flagSize} />
        <span className="font-mono tracking-wide">ID</span>
      </button>
    </div>
  );
};

