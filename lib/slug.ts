/** "Bách Khoa: đồ án & cà phê" -> "bach-khoa-do-an-ca-phe". Vietnamese đ/Đ is not decomposed by NFD, so map it first. */
export function slugify(input: string, max = 80): string {
  return input
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
}

/** Returns `base`, or `base-2`, `base-3`… whichever is free. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const root = base || 'untitled'
  if (!used.has(root)) return root
  for (let i = 2; ; i++) if (!used.has(`${root}-${i}`)) return `${root}-${i}`
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
