// Build config for the standalone Android app (Capacitor).
// Produces a plain static bundle in dist-native/ with no server involved,
// so the app runs entirely inside the phone, offline.
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  define: {
    "import.meta.env.VITE_NATIVE_APP": JSON.stringify("true"),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist-native",
    emptyOutDir: true,
    // Mantém o pacote compatível com WebViews mais antigas (Android 6+).
    target: ["es2017", "chrome61"],
    rollupOptions: {
      input: fileURLToPath(new URL("./index.native.html", import.meta.url)),
    },
  },
});
