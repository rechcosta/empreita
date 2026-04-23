interface LogoProps {
  /** Square size in px. Controls the icon box only. */
  size?: number
  /** `icon` = box only. `lockup` = box + "empreita" wordmark beside it. */
  variant?: 'icon' | 'lockup'
  /** Wordmark color (only used when variant="lockup"). */
  textColor?: string
  className?: string
}

export function Logo({
  size = 48,
  variant = 'icon',
  textColor = '#111827',
  className = '',
}: LogoProps) {
  // The icon: orange rounded square containing dome + 3 ascending bars
  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Empreita"
    >
      {/* Orange rounded square background */}
      <rect x="0" y="0" width="100" height="100" rx="20" fill="#FF7A00" />

      {/* Dome + ground ellipse (translated to center in the box, scaled 0.7x) */}
      <g transform="translate(50, 62) scale(0.7)">
        <ellipse cx="0" cy="26" rx="52" ry="9" fill="#FFFFFF" opacity="0.3" />
        <path
          d="M-44,26 Q-44,-20 0,-32 Q44,-20 44,26 Z"
          fill="#FFFFFF"
          opacity="0.35"
        />
        {/* 3 ascending vertical bars (chart shape) */}
        <rect x="-22" y="4"  width="10" height="20" rx="2" fill="#FFFFFF" opacity="0.95" />
        <rect x="-6"  y="-6" width="10" height="30" rx="2" fill="#FFFFFF" opacity="0.95" />
        <rect x="10"  y="-16" width="10" height="40" rx="2" fill="#FFFFFF" opacity="0.95" />
      </g>
    </svg>
  )

  if (variant === 'icon') {
    return <div className={className}>{icon}</div>
  }

  // Lockup: icon + wordmark side by side
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {icon}
      <span
        className="font-bold tracking-tight"
        style={{
          color: textColor,
          fontSize: size * 0.55,
          fontFamily: "'Outfit', 'Inter', sans-serif",
        }}
      >
        empreita
      </span>
    </div>
  )
}