import type { CapacitorConfig } from "@capacitor/cli";

// Native Android app: all files are bundled inside the APK (dist-native),
// so the app opens and works with no internet connection at all.
const config: CapacitorConfig = {
  appId: "br.com.contagem.mercadorias",
  appName: "Contagem",
  webDir: "dist-native",
  android: {
    allowMixedContent: false,
  },
};

export default config;
