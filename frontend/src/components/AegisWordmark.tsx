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
  // Balanced sizing: logo height is optically on-par with the main "AEGIS" text height
  const sizeStyles = {
    xs: {
      text: 'text-sm font-bold tracking-[0.14em] leading-none',
      logo: 'h-4 w-4',
      subtitle: 'text-xs tracking-[0.18em] mt-1 text-slate-400 font-medium',
    },
    sm: {
      text: 'text-lg font-bold tracking-[0.16em] leading-none',
      logo: 'h-5 w-5',
      subtitle: 'text-xs tracking-[0.18em] mt-1 text-slate-400 font-medium',
    },
    md: {
      text: 'text-2xl font-bold tracking-[0.18em] leading-none',
      logo: 'h-6 w-6 sm:h-7 sm:w-7',
      subtitle: 'text-xs tracking-[0.2em] mt-1.5 text-slate-400 font-medium',
    },
    lg: {
      text: 'text-3xl sm:text-4xl font-extrabold tracking-[0.2em] leading-none',
      logo: 'h-8 w-8 sm:h-9 sm:w-9',
      subtitle: 'text-xs sm:text-sm tracking-[0.22em] mt-2 text-slate-300 font-medium',
    },
    xl: {
      text: 'text-5xl sm:text-6xl font-extrabold tracking-[0.22em] leading-none',
      logo: 'h-12 w-12 sm:h-14 sm:w-14',
      subtitle: 'text-sm sm:text-base tracking-[0.24em] mt-2.5 text-slate-400 font-medium',
    },
  }[size];

  // The wordmark typography with signature vertical gradient:
  // Transitioning from deep blue at the bottom to cyan or light blue-ish at the top
  const wordmarkContent = (
    <span
      className={`font-arcane select-none transition-all duration-300 ${sizeStyles.text} aegis-text-gradient aegis-glow relative inline-block`}
      style={{
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

  // The logo is placed directly beside the main "AEGIS" text with matching optical height
  const innerContent = (
    <div className={`flex flex-col min-w-0 ${className}`}>
      <div className="flex items-center gap-3">
        {withLogo && (
          <img
            src="/logo.svg"
            alt="AEGIS Crest"
            className={`${logoClassName || sizeStyles.logo} object-contain shrink-0 transition-transform duration-300 hover:scale-105 filter drop-shadow-[0_2px_8px_rgba(6,182,212,0.35)]`}
          />
        )}
        {wordmarkContent}
      </div>

      {showSubtitle && (
        <p
          className={`font-sans uppercase ${sizeStyles.subtitle} transition-colors pl-0.5`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );

  if (asLink) {
    return (
      <Link
        to="/"
        className="group inline-flex flex-col justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-md transition-opacity hover:opacity-95"
      >
        {innerContent}
      </Link>
    );
  }

  return innerContent;
};

export default AegisWordmark;
