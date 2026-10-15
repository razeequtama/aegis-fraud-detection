import React from 'react';
import { Link } from 'react-router-dom';

export interface AegisWordmarkProps {
  /**
   * Size presets:
   * - 'xs': Compact inline mentions (e.g. inside paragraph text or badges)
   * - 'sm': Mobile topbar / headers
   * - 'md': Mobile drawer header / modal headers
   * - 'lg': Desktop sidebar brand title
   * - 'xl': Hero / splash displays
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Include the official Aegis shield crest */
  withLogo?: boolean;
  /** Whether to display the refined subtitle tagline */
  showSubtitle?: boolean;
  /** Subtitle text override */
  subtitle?: string;
  /** Wrap wordmark in a Link to '/' */
  asLink?: boolean;
  /** Render inline without flex wrapper block */
  inline?: boolean;
  /** Optional extra classes */
  className?: string;
  /** Optional custom logo image class */
  logoClassName?: string;
}

export const AegisWordmark: React.FC<AegisWordmarkProps> = ({
  size = 'md',
  withLogo = false,
  showSubtitle = false,
  subtitle = 'Fraud Detection Platform',
  asLink = false,
  inline = false,
  className = '',
  logoClassName = '',
}) => {
  const sizeStyles = {
    xs: {
      text: 'text-sm font-bold tracking-[0.14em]',
      logo: 'w-4 h-4',
      subtitle: 'text-[8px] tracking-[0.2em] -mt-0.5',
    },
    sm: {
      text: 'text-base font-bold tracking-[0.16em]',
      logo: 'w-5 h-5',
      subtitle: 'text-[9px] tracking-[0.22em] -mt-0.5',
    },
    md: {
      text: 'text-2xl font-bold tracking-[0.18em]',
      logo: 'w-8 h-8',
      subtitle: 'text-[10px] tracking-[0.24em] mt-0.5',
    },
    lg: {
      text: 'text-3xl sm:text-4xl font-extrabold tracking-[0.2em]',
      logo: 'w-11 h-11',
      subtitle: 'text-xs tracking-[0.26em] mt-1',
    },
    xl: {
      text: 'text-5xl sm:text-6xl font-extrabold tracking-[0.22em]',
      logo: 'w-16 h-16',
      subtitle: 'text-sm tracking-[0.28em] mt-1.5',
    },
  }[size];

  // The wordmark typography with signature vertical gradient:
  // Transitioning from deep blue at the bottom to cyan or light blue-ish at the top
  const wordmarkContent = (
    <span
      className={`font-arcane select-none transition-all duration-300 ${sizeStyles.text} aegis-text-gradient aegis-glow relative inline-block`}
      style={{
        // Fallback gradient inline style to guarantee exact blue-to-cyan gradient on all browsers
        backgroundImage: 'linear-gradient(to top, #1e40af 0%, #0284c7 35%, #06b6d4 70%, #67e8f9 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}
    >
      AEGIS
    </span>
  );

  if (inline) {
    return asLink ? (
      <Link
        to="/"
        className={`inline-flex items-baseline hover:opacity-90 transition-opacity ${className}`}
      >
        {wordmarkContent}
      </Link>
    ) : (
      <span className={`inline-block ${className}`}>{wordmarkContent}</span>
    );
  }

  const innerContent = (
    <div className={`flex items-center gap-3 ${className}`}>
      {withLogo && (
        <div className="relative shrink-0 flex items-center justify-center">
          <img
            src="/logo.svg"
            alt="AEGIS Crest"
            className={`${logoClassName || sizeStyles.logo} object-contain transition-transform duration-300 hover:scale-105 filter drop-shadow-[0_2px_10px_rgba(6,182,212,0.35)]`}
          />
        </div>
      )}

      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          {wordmarkContent}
        </div>

        {showSubtitle && (
          <p
            className={`font-sans font-medium uppercase text-slate-400 ${sizeStyles.subtitle} transition-colors`}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );

  if (asLink) {
    return (
      <Link
        to="/"
        className="group inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-md transition-opacity hover:opacity-95"
      >
        {innerContent}
      </Link>
    );
  }

  return innerContent;
};

export default AegisWordmark;

