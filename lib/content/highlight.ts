import { createCssVariablesTheme, createHighlighter, type BundledLanguage, type Highlighter } from 'shiki'

// Colours come from CSS variables (see app/globals.css), so one render serves both light and dark themes.
const theme = createCssVariablesTheme({ name: 'ctcd', variablePrefix: '--shiki-', fontStyle: true })

export const LANGS = [
  'python', 'javascript', 'typescript', 'tsx', 'jsx', 'bash', 'json', 'html', 'css', 'sql',
  'latex', 'markdown', 'yaml', 'go', 'rust', 'c', 'cpp', 'java',
] as const satisfies readonly BundledLanguage[]

const ALIASES: Record<string, string> = { py: 'python', js: 'javascript', ts: 'typescript', sh: 'bash', shell: 'bash', tex: 'latex', md: 'markdown', yml: 'yaml' }

let highlighter: Promise<Highlighter> | null = null
const getHighlighter = () => (highlighter ??= createHighlighter({ themes: [theme], langs: [...LANGS] }))

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESC[c]!)

export async function highlight(code: string, language: string): Promise<string> {
  const lang = ALIASES[language] ?? language
  if (!(LANGS as readonly string[]).includes(lang)) {
    return `<pre class="ct-code-pre"><code>${esc(code)}</code></pre>`
  }
  const hl = await getHighlighter()
  const { tokens } = hl.codeToTokens(code, { lang: lang as BundledLanguage, theme: 'ctcd' })
  const lines = tokens.map((line) =>
    line
      .map((t) => {
        const style: string[] = []
        if (t.color) style.push(`color:${t.color}`)
        if (t.fontStyle && t.fontStyle & 1) style.push('font-style:italic')
        if (t.fontStyle && t.fontStyle & 2) style.push('font-weight:600')
        return style.length ? `<span style="${esc(style.join(';'))}">${esc(t.content)}</span>` : esc(t.content)
      })
      .join(''),
  )
  return `<pre class="ct-code-pre"><code>${lines.join('\n')}</code></pre>`
}
