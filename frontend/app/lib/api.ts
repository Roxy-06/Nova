// Shared API base URL resolver.
//
// Resolution order:
//   1. NEXT_PUBLIC_API_BASE env var (set in the Vercel dashboard / Render
//      build for the production frontend).
//   2. NEXT_PUBLIC_API_URL env var (legacy alias used by .env.local.example).
//   3. Production fallback: the Render backend URL. This makes the deployed
//      site work out-of-the-box even if the env var is accidentally missing,
//      instead of silently pointing at the visitor's own localhost.
//   4. Local development fallback: http://localhost:8000.
//
// The trailing slash is stripped so callers can safely append "/api/...".

// Actual Render backend URL for the "Nova" service (service id
// srv-d9s4sclbedkc73cspjc0). Keep in sync with the NEXT_PUBLIC_API_BASE env
// var set on the Vercel frontend project.
const RENDER_BACKEND_URL = "https://nova-i72b.onrender.com";
const LOCAL_BACKEND_URL = "http://localhost:8000";

export function getApiBase(): string {
  const fromBase = process.env.NEXT_PUBLIC_API_BASE;
  const fromUrl = process.env.NEXT_PUBLIC_API_URL;

  if (fromBase && fromBase.trim()) return fromBase.trim().replace(/\/+$/, "");
  if (fromUrl && fromUrl.trim()) return fromUrl.trim().replace(/\/+$/, "");

  // In production builds (Vercel), if no env var was provided, fall back to
  // the Render backend so the app actually works rather than pointing at the
  // client's own machine.
  if (process.env.NODE_ENV === "production") {
    return RENDER_BACKEND_URL;
  }

  return LOCAL_BACKEND_URL;
}
