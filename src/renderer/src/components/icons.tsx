/** Satır içi SVG ikonları. Hepsi currentColor kullanır. */

type IconProps = { size?: number }

function stroke(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  }
}

/** Marka işareti: üst üste binmiş sayfalar (sürümleri simgeler). */
export function BrandMark({ size = 26 }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="6" y="3.5" width="12" height="15" rx="2" fill="currentColor" opacity="0.28" />
      <rect x="4" y="5.5" width="12" height="15" rx="2" fill="currentColor" opacity="0.55" />
      <rect
        x="2"
        y="7.5"
        width="12"
        height="15"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  )
}

export function FilesIcon({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-6-6Z" />
      <path d="M13 3v6h6" />
    </svg>
  )
}

export function SendIcon({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <path d="M21 4 3 11l7 3 3 7 8-17Z" />
      <path d="m10 14 4-4" />
    </svg>
  )
}

export function HistoryIcon({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4l3 2" />
    </svg>
  )
}

export function SettingsIcon({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  )
}

export function ProfileIcon({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  )
}

export function CollapseIcon({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  )
}

export function GlobeIcon({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  )
}

export function GithubIcon({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  )
}

export function ExternalIcon({ size = 15 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </svg>
  )
}

export function CheckIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <path d="m20 6-11 11-5-5" />
    </svg>
  )
}

export function BackIcon({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export function ContrastIcon({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function FolderIcon({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  )
}

export function UpIcon({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <path d="M12 19V6" />
      <path d="m5 13 7-7 7 7" />
    </svg>
  )
}

export function GitLabIcon({ size = 22 }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="m12 21 3.2-9.8H8.8L12 21Z" />
      <path d="M12 21 8.8 11.2H4.3L12 21Z" opacity="0.75" />
      <path d="M4.3 11.2 3.3 14.3a.7.7 0 0 0 .25.78L12 21 4.3 11.2Z" opacity="0.5" />
      <path d="M4.3 11.2 5.7 6.9a.35.35 0 0 1 .67 0l1.43 4.3H4.3Z" opacity="0.9" />
      <path d="M12 21l3.2-9.8h4.5L12 21Z" opacity="0.75" />
      <path d="M19.7 11.2l1 3.1a.7.7 0 0 1-.25.78L12 21l7.7-9.8Z" opacity="0.5" />
      <path d="M19.7 11.2 18.3 6.9a.35.35 0 0 0-.67 0l-1.43 4.3h3.5Z" opacity="0.9" />
    </svg>
  )
}

export function JiraIcon({ size = 22 }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 22 12 12 22 2 12 12 2Z" opacity="0.22" />
      <path d="m12 6 6 6-6 6-6-6 6-6Z" />
    </svg>
  )
}

export function RefreshIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  )
}

export function DotsIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  )
}

export function PlusIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function PinIcon({ size = 15 }: IconProps): JSX.Element {
  return (
    <svg {...stroke(size)}>
      <path d="M12 17v5" />
      <path d="M9 3h6l-1 6 3 3H7l3-3-1-6Z" />
    </svg>
  )
}
