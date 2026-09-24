import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      strategies: "generateSW",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Take control on the first load so offline works immediately.
        clientsClaim: true,
        skipWaiting: true,
        // SSR (TanStack Start) has no static index.html. Setting null disables
        // the default NavigationRoute (which serves a non-existent precached
        // index.html and breaks offline navigation). The NetworkFirst route
        // below caches the server-rendered HTML at runtime instead.
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
        // Build output nests files under client/ but the server serves them
        // from the root. Strip the prefix so precache URLs resolve correctly.
        manifestTransforms: [
          (entries) => ({
            manifest: entries.map((e) => ({
              ...e,
              url: e.url.replace(/^client\//, ""),
            })),
            warnings: [],
          }),
        ],
        // Caches every app page at install time and serves them offline,
        // so the app works without a connection from the first launch.
        importScripts: ["/sw-offline-extra.js"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.origin && /\.(?:js|css|woff2|png|svg|ico)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "contagem-assets",
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
