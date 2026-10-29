import { IconButton, Logo } from '@/components/ds/primitives'
import { SubscribeForm } from '@/components/ds/SubscribeForm'
import { getSettings } from '@/lib/db/queries/public'
import { SITE, socialsWith } from '@/lib/site'

export async function SiteFooter() {
  const settings = await getSettings()
  return (
    <footer className="site-footer">
      <div className="wrap site-footer-row">
        <div className="stack-8">
          <Logo size="sm" href="/" />
          <span className="small muted">© 2026 {SITE.author}</span>
        </div>
        <div className="site-footer-end">
          <nav aria-label="Social" className="row-8">
            {socialsWith(settings.socials).map((s) => (
              <IconButton key={s.icon} icon={s.icon} label={s.label} href={s.href} />
            ))}
          </nav>
          <SubscribeForm id="subscribe" />
        </div>
      </div>
    </footer>
  )
}
