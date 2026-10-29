import type { CSSProperties, SVGProps } from 'react'

type Part = [tag: 'rect' | 'path' | 'circle', attrs: SVGProps<SVGElement> & Record<string, unknown>]

const ICONS: Record<string, Part[]> = {
  lock: [['rect', { x: 4, y: 11, width: 16, height: 10, rx: 2 }], ['path', { d: 'M8 11V7a4 4 0 0 1 8 0v4' }]],
  unlock: [['rect', { x: 4, y: 11, width: 16, height: 10, rx: 2 }], ['path', { d: 'M8 11V7a4 4 0 0 1 7.5-2' }]],
  globe: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18' }]],
  link: [['path', { d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1' }], ['path', { d: 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' }]],
  users: [['circle', { cx: 9, cy: 8, r: 3.5 }], ['path', { d: 'M2.5 20a6.5 6.5 0 0 1 13 0' }], ['path', { d: 'M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6' }]],
  sun: [['circle', { cx: 12, cy: 12, r: 4 }], ['path', { d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }]],
  moon: [['path', { d: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' }]],
  play: [['path', { d: 'M7 4l13 8-13 8z', fill: 'currentColor' }]],
  pause: [['path', { d: 'M7 4v16M17 4v16', strokeWidth: 3.2 }]],
  skip: [['path', { d: 'M5 4l10 8-10 8z' }], ['path', { d: 'M19 5v14' }]],
  search: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'M20 20l-3.5-3.5' }]],
  'arrow-right': [['path', { d: 'M5 12h14M13 6l6 6-6 6' }]],
  'arrow-left': [['path', { d: 'M19 12H5M11 6l-6 6 6 6' }]],
  terminal: [['rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }], ['path', { d: 'M7 9l3 3-3 3M13 15h4' }]],
  music: [['path', { d: 'M9 18V5l11-2v13' }], ['circle', { cx: 6, cy: 18, r: 3 }], ['circle', { cx: 17, cy: 16, r: 3 }]],
  copy: [['rect', { x: 8, y: 8, width: 13, height: 13, rx: 2 }], ['path', { d: 'M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3' }]],
  check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
  x: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
  info: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 8v.01M11 12h1v5h1' }]],
  mail: [['rect', { x: 3, y: 5, width: 18, height: 14, rx: 2 }], ['path', { d: 'M3 7l9 6 9-6' }]],
  rss: [['path', { d: 'M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16' }], ['circle', { cx: 5, cy: 19, r: 1, fill: 'currentColor' }]],
  instagram: [['rect', { x: 3, y: 3, width: 18, height: 18, rx: 5 }], ['circle', { cx: 12, cy: 12, r: 4 }], ['circle', { cx: 17.5, cy: 6.5, r: 1, fill: 'currentColor' }]],
  tiktok: [['path', { d: 'M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5' }], ['path', { d: 'M14 3c.5 2.8 2.3 4.5 5 4.8' }]],
  youtube: [['rect', { x: 2, y: 5, width: 20, height: 14, rx: 4 }], ['path', { d: 'M10 9l5 3-5 3z', fill: 'currentColor' }]],
  linkedin: [['rect', { x: 3, y: 3, width: 18, height: 18, rx: 3 }], ['path', { d: 'M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7' }]],
  github: [['path', { d: 'M9 19c-4 1.3-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21' }]],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  pen: [['path', { d: 'M4 20h4L19 9l-4-4L4 16z' }], ['path', { d: 'M13.5 6.5l4 4' }]],
  file: [['path', { d: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z' }], ['path', { d: 'M14 3v6h6M8 13h8M8 17h5' }]],
  book: [['path', { d: 'M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2z' }], ['path', { d: 'M5 17a2 2 0 0 1 2-2h12' }]],
  folder: [['path', { d: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }]],
  box: [['path', { d: 'M3 7l9-4 9 4-9 4z' }], ['path', { d: 'M3 7v10l9 4 9-4V7M12 11v10' }]],
  share: [['circle', { cx: 18, cy: 5, r: 2.5 }], ['circle', { cx: 6, cy: 12, r: 2.5 }], ['circle', { cx: 18, cy: 19, r: 2.5 }], ['path', { d: 'M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4' }]],
  settings: [['circle', { cx: 12, cy: 12, r: 3 }], ['path', { d: 'M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1' }]],
  external: [['path', { d: 'M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5' }]],
  grid: [['rect', { x: 3, y: 3, width: 7, height: 9, rx: 1.5 }], ['rect', { x: 14, y: 3, width: 7, height: 5, rx: 1.5 }], ['rect', { x: 14, y: 12, width: 7, height: 9, rx: 1.5 }], ['rect', { x: 3, y: 16, width: 7, height: 5, rx: 1.5 }]],
  panel: [['rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }], ['path', { d: 'M15 4v16' }]],
}

export type IconName = keyof typeof ICONS | (string & {})

export function Icon({
  name = 'info',
  size = 18,
  label,
  strokeWidth = 2,
  className,
  style,
}: {
  name?: IconName
  size?: number
  label?: string
  strokeWidth?: number
  className?: string
  style?: CSSProperties
}) {
  const parts = ICONS[name] ?? ICONS.info!
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const }
  return (
    <svg
      className={['ct-icon', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      {...a11y}
    >
      {parts.map(([Tag, attrs], i) => {
        const El = Tag as 'path'
        return <El key={i} {...(attrs as SVGProps<SVGPathElement>)} />
      })}
    </svg>
  )
}
