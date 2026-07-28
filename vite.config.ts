/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true
      }
    }
  },
  plugins: [tailwindcss(), preact(), ...(process.env.VITE_DISABLE_PWA ? [] : [VitePWA({
    registerType: "autoUpdate",
    includeAssets: ["**/*"],
    manifest: {
      name: "POS - Punto de Venta",
      short_name: "POS",
      description: "Sistema de punto de venta offline-first",
      theme_color: "#1e293b",
      background_color: "#f8fafc",
      display: "standalone",
      orientation: "portrait",
      start_url: "/",
      icons: [{
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml"
      }, {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any maskable"
      }]
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      navigateFallback: "/index.html",
      navigateFallbackDenylist: [/^\/api\//]
    }
  })])],
  build: {
    target: "esnext",
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/rxdb")) return "rxdb";
          if (id.includes("node_modules/rxjs")) return "rxjs";
          if (id.includes("node_modules")) return "vendor";
        }
      }
    }
  },
  test: {
    projects: [{
      extends: true,
      test: {
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});