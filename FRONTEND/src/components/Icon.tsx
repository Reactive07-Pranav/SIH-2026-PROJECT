import type { SVGProps } from 'react'

// Authored 24px line icons, one stroke weight, so no icon dependency ships in the PWA.
const paths = {
  camera: <><path d="M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5z" /><circle cx="12" cy="13" r="3.5" /></>,
  scan: <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />,
  log: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  map: <><path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z" /><path d="M9 4v13.5M15 6.5V20" /></>,
  sync: <><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 20v-4h-4" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l5-5-5-5M15 12H4" /></>,
  shieldCheck: <><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></>,
  shieldX: <><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" /><path d="M9.5 9.5l5 5M14.5 9.5l-5 5" /></>,
  shield: <><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" /><path d="M12 8.5v3.5M12 15.5h.01" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  alert: <><path d="M12 4L2.5 20h19z" /><path d="M12 10v4M12 17h.01" /></>,
  positive: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  negative: <><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></>,
  inconclusive: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.3M12 17h.01" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  upload: <><path d="M12 15V4M7 9l5-5 5 5" /><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  language: <><path d="M4 5h9M8.5 3v2M6 5c.6 3 2.6 5.4 5.5 7M11 5c-.6 3.2-3 6-6.5 7.5" /><path d="M13 21l4-9 4 9M14.5 18h5" /></>,
  cloudOff: <><path d="M3 3l18 18" /><path d="M7.5 7.6A6 6 0 0 0 6.5 19H17M20.6 16.8A4 4 0 0 0 17.5 10a6 6 0 0 0-7-4.8" /></>,
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {paths[name]}
    </svg>
  )
}

/** Brand mark: the L of a forensic photo scale with a sample point. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path d="M8 7v17h17" fill="none" stroke="var(--on-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11h2.5M8 15h3.5M8 19h2.5M12 24v-2.5M16 24v-3.5M20 24v-2.5" stroke="var(--on-accent)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="19" cy="13" r="3.4" fill="var(--on-accent)" />
    </svg>
  )
}
