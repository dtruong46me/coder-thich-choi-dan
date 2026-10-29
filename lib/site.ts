export const SITE = {
  name: 'Coder thích chơi đàn',
  handle: '@coderthichchoidan',
  author: 'Dinh Truong Phan',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  description: 'I write code by day and play guitar and piano by night. These are my notes.',
}

export const SOCIALS = [
  { icon: 'instagram', label: 'Instagram', handle: '@coderthichchoidan', href: 'https://instagram.com/coderthichchoidan' },
  { icon: 'tiktok', label: 'TikTok', handle: '@coderthichchoidan', href: 'https://tiktok.com/@coderthichchoidan' },
  { icon: 'youtube', label: 'YouTube', handle: '@coderthichchoidan', href: 'https://youtube.com/@coderthichchoidan' },
  { icon: 'linkedin', label: 'LinkedIn', handle: 'in/coderthichchoidan', href: 'https://linkedin.com/in/coderthichchoidan' },
  { icon: 'github', label: 'GitHub', handle: 'coderthichchoidan', href: 'https://github.com/coderthichchoidan' },
  { icon: 'mail', label: 'Email', handle: 'hello@coderthichchoidan.dev', href: 'mailto:hello@coderthichchoidan.dev' },
] as const

/** Social links with any overrides saved in Manage › Settings (key = icon name). */
export const socialsWith = (overrides: Record<string, string> = {}) =>
  SOCIALS.map((s) => {
    const href = overrides[s.icon]?.trim()
    return href ? { ...s, href: s.icon === 'mail' && !href.startsWith('mailto:') ? `mailto:${href}` : href } : s
  })

// Subscriber topics map to collections: a post goes to subscribers whose topics include its collection's topic.
export const TOPICS = ['Guitar', 'Piano', 'Code', 'Japan', 'Bách Khoa'] as const
export type Topic = (typeof TOPICS)[number]
export const COLLECTION_TOPIC: Record<string, Topic | undefined> = {
  guitar: 'Guitar',
  piano: 'Piano',
  code: 'Code',
  japan: 'Japan',
  'bach-khoa': 'Bách Khoa',
}

export const absoluteUrl = (path: string) => new URL(path, SITE.url).toString()
