import katex from 'katex'

/** Server-side KaTeX. trust: false blocks \href, \includegraphics and friends; errors render inline in red. */
export function renderMath(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, {
    displayMode,
    throwOnError: false,
    trust: false,
    strict: 'warn',
    output: 'htmlAndMathml',
    maxSize: 20,
    maxExpand: 500,
  })
}
