import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { SITE_URL, indexablePaths, absoluteUrl } from './web/src/site.js'

const repoRoot = import.meta.dirname
const webRoot = resolve(repoRoot, 'web')

// Single-page app (vue-router). Web sources live in web/; scraper data lives
// in data/. Setting publicDir to the data folder lets Vite serve and copy it
// natively during dev and build.
export default defineConfig({
  root: webRoot,
  publicDir: resolve(repoRoot, 'data'),
  plugins: [vue()],
  test: { root: repoRoot, include: ['test/**/*.test.js'] },
  ssgOptions: {
    dirStyle: 'flat',
    includedRoutes: () => [...indexablePaths, '/404'],
    onFinished() {
      const dist = resolve(repoRoot, 'dist')
      const urls = indexablePaths.map((p) => `  <url><loc>${absoluteUrl(p)}</loc></url>`).join('\n')
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
      writeFileSync(resolve(dist, 'sitemap.xml'), sitemap)
      writeFileSync(resolve(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`)
    },
  },
  build: {
    outDir: resolve(repoRoot, 'dist'),
    emptyOutDir: true,
  },
})
