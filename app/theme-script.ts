import { createHash } from 'node:crypto'

// Runs before first paint so there is no light/dark flash. Its hash is allowed by the admin CSP (proxy.ts).
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})()`

export const THEME_SCRIPT_HASH = `'sha256-${createHash('sha256').update(THEME_SCRIPT).digest('base64')}'`
