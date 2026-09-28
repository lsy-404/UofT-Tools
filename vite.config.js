import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

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
  build: {
    outDir: resolve(repoRoot, 'dist'),
    emptyOutDir: true,
  },
})
