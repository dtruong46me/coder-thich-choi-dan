const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 21, 2026". Formatted in Asia/Tokyo so server and browser agree. */
export function formatDate(iso: string | Date | null | undefined, opts: { year?: boolean } = {}): string {
  if (!iso) return ''
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`
  return opts.year === false ? base : `${base}, ${d.getFullYear()}`
}

export function formatTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
