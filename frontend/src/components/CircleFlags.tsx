import React, { useId } from 'react';

export interface CircleFlagProps {
  size?: number;
  className?: string;
  title?: string;
}

export const CircleFlagEn: React.FC<CircleFlagProps> = ({
  size = 20,
  className = '',
  title = 'English',
}) => {
  const clipId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`shrink-0 rounded-full shadow-sm aspect-square overflow-hidden select-none ${className}`}
      aria-label={title}
      role="img"
    >
      <title>{title}</title>
      <defs>
        <clipPath id={clipId}>
          <circle cx="16" cy="16" r="16" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* Navy Blue Base */}
        <rect width="32" height="32" fill="#012169" />

        {/* White Saltire (Diagonals) */}
        <line x1="0" y1="0" x2="32" y2="32" stroke="#FFFFFF" strokeWidth="6.5" />
        <line x1="32" y1="0" x2="0" y2="32" stroke="#FFFFFF" strokeWidth="6.5" />

        {/* Red Saltire (Diagonals) */}
        <line x1="0" y1="0" x2="32" y2="32" stroke="#C8102E" strokeWidth="2.2" />
        <line x1="32" y1="0" x2="0" y2="32" stroke="#C8102E" strokeWidth="2.2" />

        {/* St George's White Cross */}
        <rect x="12" y="0" width="8" height="32" fill="#FFFFFF" />
        <rect x="0" y="12" width="32" height="8" fill="#FFFFFF" />

        {/* St George's Red Cross */}
        <rect x="13.6" y="0" width="4.8" height="32" fill="#C8102E" />
        <rect x="0" y="13.6" width="32" height="4.8" fill="#C8102E" />

        {/* Outer Circular Rim Border */}
        <circle
          cx="16"
          cy="16"
          r="15.25"
          fill="none"
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
};

export const CircleFlagId: React.FC<CircleFlagProps> = ({
  size = 20,
  className = '',
  title = 'Bahasa Indonesia',
}) => {
  const clipId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`shrink-0 rounded-full shadow-sm aspect-square overflow-hidden select-none ${className}`}
      aria-label={title}
      role="img"
    >
      <title>{title}</title>
      <defs>
        <clipPath id={clipId}>
          <circle cx="16" cy="16" r="16" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* Indonesian Red Top Half */}
        <rect x="0" y="0" width="32" height="16" fill="#CE1126" />

        {/* Indonesian White Bottom Half */}
        <rect x="0" y="16" width="32" height="16" fill="#FFFFFF" />

        {/* Outer Circular Rim Border for crisp boundary */}
        <circle
          cx="16"
          cy="16"
          r="15.25"
          fill="none"
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
};

export interface FlagProps extends CircleFlagProps {
  code: 'en' | 'id';
}

export const CircleFlag: React.FC<FlagProps> = ({ code, ...props }) => {
  if (code === 'id') {
    return <CircleFlagId {...props} />;
  }
  return <CircleFlagEn {...props} />;
};

