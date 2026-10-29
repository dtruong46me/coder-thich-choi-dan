import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Visibility } from '@/lib/db/schema'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'

// Server-safe building blocks from the Coder thích chơi đàn design system (class names match ds.css).

const isInternal = (href: string) => href.startsWith('/') && !href.startsWith('//')

function SmartLink({ href, className, children, ...rest }: { href: string; className?: string; children: ReactNode; 'aria-label'?: string; 'aria-current'?: 'page' }) {
  return isInternal(href) ? (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  )
}

export function Logo({ href, size = 'md', showHandle = true }: { href?: string; size?: 'sm' | 'md'; showHandle?: boolean }) {
  const inner = (
    <>
      <span className={`ct-logo-mark ct-logo-${size}`} aria-hidden="true">
        c♪
      </span>
      <span className="ct-logo-text">
        <span className="ct-logo-name">Coder thích chơi đàn</span>
        {showHandle ? <span className="ct-logo-handle">@coderthichchoidan</span> : null}
      </span>
    </>
  )
  return href ? (
    <SmartLink href={href} className="ct-logo">
      {inner}
    </SmartLink>
  ) : (
    <span className="ct-logo">{inner}</span>
  )
}

type ButtonProps = {
  variant?: 'primary' | 'ghost' | 'quiet'
  size?: 'sm' | 'md'
  icon?: IconName
  iconRight?: IconName
  href?: string
  mono?: boolean
  children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

export function Button({ variant = 'primary', size = 'md', icon, iconRight, href, mono, className, children, ...rest }: ButtonProps) {
  const cls = cx('ct-btn', `ct-btn-${variant}`, `ct-btn-${size}`, mono && 'ct-mono', className)
  const kids = (
    <>
      {icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} /> : null}
      <span>{children}</span>
      {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 15 : 17} /> : null}
    </>
  )
  if (href)
    return (
      <SmartLink href={href} className={cls}>
        {kids}
      </SmartLink>
    )
  return (
    <button type="button" {...rest} className={cls}>
      {kids}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  href,
  size,
  pressed,
  className,
  ...rest
}: { icon: IconName; label: string; href?: string; size?: 'sm'; pressed?: boolean } & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
>) {
  const cls = cx('ct-iconbtn', size === 'sm' && 'ct-iconbtn-sm', className)
  const glyph = <Icon name={icon} size={size === 'sm' ? 15 : 18} />
  if (href)
    return (
      <SmartLink href={href} className={cls} aria-label={label}>
        {glyph}
      </SmartLink>
    )
  return (
    <button type="button" {...rest} className={cls} aria-label={label} aria-pressed={pressed === undefined ? undefined : pressed}>
      {glyph}
    </button>
  )
}

export function Chip({
  selected,
  prefix = '#',
  onClick,
  children,
}: {
  selected?: boolean
  prefix?: string
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className={cx('ct-chip', selected && 'is-on')} aria-pressed={!!selected} onClick={onClick}>
      {prefix ? (
        <span className="ct-chip-prefix" aria-hidden="true">
          {prefix}
        </span>
      ) : null}
      {children}
    </button>
  )
}

export const VISIBILITY: Record<Visibility, { label: string; icon: IconName; desc: string }> = {
  public: { label: 'Public', icon: 'globe', desc: 'Anyone. Listed on the blog, in search and in the feed.' },
  unlisted: { label: 'Unlisted', icon: 'link', desc: 'Anyone with the link. Hidden from lists, search and the feed.' },
  members: { label: 'Members', icon: 'mail', desc: 'Signed-in subscribers only.' },
  shared: { label: 'Shared', icon: 'users', desc: 'Only the accounts you add below.' },
  private: { label: 'Private', icon: 'lock', desc: 'Only you. The default for diary entries.' },
}

export function VisibilityBadge({ mode, count, className }: { mode: Visibility; count?: number; className?: string }) {
  const v = VISIBILITY[mode] ?? VISIBILITY.public
  return (
    <span className={cx('ct-badge', `ct-badge-${mode}`, className)}>
      <Icon name={v.icon} size={12} strokeWidth={2.4} />
      {v.label.toUpperCase()}
      {mode === 'shared' && count ? ` · ${count}` : ''}
    </span>
  )
}

export function Callout({ tone = 'note', title, children }: { tone?: 'note' | 'tip' | 'warn'; title?: string; children: ReactNode }) {
  return (
    <div className={cx('ct-callout', `ct-callout-${tone}`)} role={tone === 'warn' ? 'note' : undefined}>
      <Icon name={tone === 'tip' ? 'check' : 'info'} size={20} />
      <div className="ct-callout-body">
        {title ? <strong>{title} </strong> : null}
        {children}
      </div>
    </div>
  )
}

export function CommandHint({ onClick, label = 'Go to' }: { onClick?: () => void; label?: string }) {
  return (
    <button type="button" className="ct-cmdhint" onClick={onClick} aria-label="Open command line (press :)">
      <kbd>:</kbd>
      <span>{label}</span>
    </button>
  )
}

export function StatusPill({ tone, children }: { tone: 'accent' | 'ochre' | 'muted' | 'danger'; children: ReactNode }) {
  const map = {
    accent: ['var(--accent-soft)', 'var(--accent)'],
    ochre: ['var(--ochre-soft)', 'var(--ochre)'],
    muted: ['var(--surface-2)', 'var(--ink-muted)'],
    danger: ['var(--danger-soft)', 'var(--danger)'],
  }[tone]
  return (
    <span className="label pill" style={{ background: map[0], color: map[1] }}>
      {children}
    </span>
  )
}
