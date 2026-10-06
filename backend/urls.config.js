// ─────────────────────────────────────────────────────────────────────────────
//  E-Docs — ALL frontend/backend URLs live HERE (and only here).
//  Change a URL/port once in this file; the frontend (Vite + React), the backend
//  (Express) and the test scripts all read it from here.
//
//  Deployment hosts can still override these with environment variables:
//    VITE_API_BASE    → overrides API_BASE_URL   (set on Vercel / frontend host)
//    FRONTEND_ORIGIN  → overrides FRONTEND_URL   (set on Render / backend host)
//    PORT             → overrides BACKEND_PORT   (most hosts set this themselves)
//
//  (This file sits in backend/ because when only the backend folder is deployed,
//   e.g. on Render, files outside it aren't available. The frontend imports it too.)
// ─────────────────────────────────────────────────────────────────────────────

/** Port the website (Vite dev server) runs on locally. */
export const FRONTEND_PORT = 5173

/** Port the API (Express backend) runs on locally. */
export const BACKEND_PORT = 8787

/** Where the website is opened in the browser. The backend only accepts browser requests
 *  from this origin (comma-separate several, e.g. 'http://localhost:5173,https://e-docs.vercel.app'). */
export const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`

/** Where the backend API runs (used by the local dev proxy and the test scripts). */
export const BACKEND_URL = `http://localhost:${BACKEND_PORT}`

/** Backend URL the BROWSER should call. Leave '' when frontend and backend share one
 *  domain (local dev via the Vite proxy, or one combined deployment). Set it to the
 *  backend's public URL when they're deployed separately, e.g. 'https://e-docs-api.onrender.com'. */
export const API_BASE_URL = ''
