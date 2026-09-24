// Single guarded registration wrapper for the PWA service worker.
// Never registers in dev, Lovable preview, iframes, or when ?sw=off is present.
// In any refused context it unregisters any matching /sw.js registration first.

const SW_URL = "/sw.js";

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  // Aplicativo Android instalado: já roda local, não precisa de service worker.
  if ((globalThis as { Capacitor?: unknown }).Capacitor) return true;
  if (window.self !== window.top) return true; // inside an iframe
  if (new URLSearchParams(window.location.search).has("sw=off")) return true;
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  return false;
}

async function unregisterMatching(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => {
        try {
          return new URL(r.scope, window.location.origin).pathname === "/" && r.active?.scriptURL.endsWith(SW_URL);
        } catch {
          return false;
        }
      })
      .map((r) => r.unregister()),
  );
}

export async function registerPwa(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  if (isRefusedContext()) {
    await unregisterMatching();
    return;
  }
  try {
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch (err) {
    console.warn("Falha ao registrar o service worker:", err);
  }
}
