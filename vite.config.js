import { defineConfig } from 'vite'

// GitHub Pages serves the site from /26_ParcStudio/
export default defineConfig({
  base: '/26_ParcStudio/',
  server: {
    host: true, // reachable from the iPhone on the same Wi-Fi
    port: 5173,
    strictPort: true, // keep the Cloudflare tunnel pointed at a stable port
    allowedHosts: true, // Cloudflare quick tunnels (*.trycloudflare.com)
  },
})
