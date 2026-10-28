import { defineConfig } from 'vite'

// GitHub Pages serves the site from /26_ParcStudio/
export default defineConfig({
  base: '/26_ParcStudio/',
  server: {
    host: true, // reachable from the iPhone on the same Wi-Fi
    allowedHosts: ['.trycloudflare.com'],
  },
})
