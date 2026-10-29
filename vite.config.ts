import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { brand } from './src/config/brand.ts'

export default defineConfig({
  // relative base so the build also works from a sub-path or a file share
  base: './',
  plugins: [
    react(),
    {
      name: 'brand-html',
      transformIndexHtml: (html) =>
        html.replaceAll('%BRAND_NAME%', brand.name).replaceAll('%BRAND_DESCRIPTION%', brand.description),
    },
  ],
  server: { host: true },
})
