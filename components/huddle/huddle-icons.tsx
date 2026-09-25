import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement> & { className?: string }

const iconStroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

// Category icons
export function StudyIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

export function CoffeeIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" x2="6" y1="2" y2="4" />
      <line x1="10" x2="10" y1="2" y2="4" />
      <line x1="14" x2="14" y1="2" y2="4" />
    </svg>
  )
}

export function WalksIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <path d="M3 17l4-8 4 4 4-6 4 10" />
      <path d="M3 21h18" />
    </svg>
  )
}

export function FitnessIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <path d="M6.5 6.5h11" />
      <path d="M6.5 17.5h11" />
      <path d="M3 9.5h3v5H3z" />
      <path d="M18 9.5h3v5h-3z" />
      <path d="M6 12h12" />
    </svg>
  )
}

export function GamesIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <line x1="6" x2="6" y1="11" y2="13" />
      <line x1="5" x2="7" y1="12" y2="12" />
      <line x1="15" x2="15" y1="13" y2="13" />
      <line x1="18" x2="18" y1="11" y2="11" />
      <path d="M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z" />
    </svg>
  )
}

export function ArtsIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" x2="9.01" y1="9" y2="9" />
      <line x1="15" x2="15.01" y1="9" y2="9" />
      <path d="M12 2a10 10 0 0 1 7.38 16.8C17.76 20.45 15 22 12 22s-5.76-1.55-7.38-3.2A10 10 0 0 1 12 2z" />
    </svg>
  )
}

export function FaithIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  )
}

export function LanguageIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  )
}

export function ServiceIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

export function HangoutIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 13s1.5 2 4 2 4-2 4-2" />
      <line x1="9" x2="9.01" y1="9" y2="9" />
      <line x1="15" x2="15.01" y1="9" y2="9" />
    </svg>
  )
}

export function SportsIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  )
}

// Status icons
export function SameWavelengthIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <path d="M12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9z" />
      <path d="M8 12c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z" />
      <path d="M14 12c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z" />
      <path d="M10 16s1 1 2 1 2-1 2-1" />
      <path d="M12 14v1" />
    </svg>
  )
}

export function SyncedIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

export function ReportIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

// Interface icons
export function FeedIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

export function CommunityIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function HostIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}

export function ChatsIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="9" y1="10" x2="9.01" y2="10" />
      <line x1="12" y1="10" x2="12.01" y2="10" />
      <line x1="15" y1="10" x2="15.01" y2="10" />
    </svg>
  )
}

export function ProfileIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...iconStroke} {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

// Huddle wordmark text logo component
export function HuddleWordmark({ className }: { className?: string }) {
  return (
    <span className={`font-heading font-black tracking-tight ${className}`}>
      huddle
    </span>
  )
}