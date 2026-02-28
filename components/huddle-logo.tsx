export function HuddleLogo({ className = "", size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-label="Huddle logo"
    >
      <path
        d="M8 28C8 20 14 14 22 14H26C34 14 40 20 40 28V30C40 32 38 34 36 34H12C10 34 8 32 8 30V28Z"
        fill="#1B3A6B"
      />
      <path
        d="M14 24C14 18 18 14 24 14C30 14 34 18 34 24V28C34 30 32 32 30 32H18C16 32 14 30 14 28V24Z"
        fill="#4A9FD4"
        opacity="0.8"
      />
      <circle cx="20" cy="22" r="2" fill="#FFFFFF" />
      <circle cx="28" cy="22" r="2" fill="#FFFFFF" />
      <path
        d="M20 26C20 26 22 29 24 29C26 29 28 26 28 26"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function HuddleLogoFull({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <HuddleLogo size={36} />
      <span className="font-heading text-xl font-bold tracking-tight">Huddle</span>
    </div>
  )
}
