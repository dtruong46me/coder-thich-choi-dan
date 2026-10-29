// JS budget for reader pages (gzip). Run against a started server:
//   node scripts/check-reader-js.mjs http://localhost:3000 /blogs/fret-math 70
//
// The React + Next.js runtime (~120 KB gzip) ships with every Next.js page and cannot be trimmed by us,
// so the budget covers everything *on top of* it: the runtime is whatever a bare 404 page loads.
import { gzipSync } from 'node:zlib'

const [base = 'http://localhost:3000', path = '/', budgetKb = '70'] = process.argv.slice(2)

async function scripts(p) {
  const html = await (await fetch(new URL(p, base))).text()
  // nomodule = legacy polyfills, never downloaded by modern browsers.
  return new Set([...html.matchAll(/<script(?![^>]*nomodule)[^>]+src="([^"]+)"/g)].map((m) => m[1]))
}
const gz = async (src) => gzipSync(Buffer.from(await (await fetch(new URL(src, base))).arrayBuffer()), { level: 9 }).length

const runtime = await scripts('/__budget_probe_404__')
const page = await scripts(path)
let runtimeSize = 0
let appSize = 0
for (const src of page) {
  const size = await gz(src)
  if (runtime.has(src)) runtimeSize += size
  else {
    appSize += size
    console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${src}`)
  }
}
console.log(`${(runtimeSize / 1024).toFixed(1).padStart(7)} KB  React + Next.js runtime (not counted)`)
console.log(`${(appSize / 1024).toFixed(1).padStart(7)} KB  app JS on ${path} (budget ${budgetKb} KB)`)
if (appSize / 1024 > Number(budgetKb)) {
  console.error(`Over budget by ${(appSize / 1024 - Number(budgetKb)).toFixed(1)} KB`)
  process.exit(1)
}
