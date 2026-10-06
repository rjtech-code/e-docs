# E-Docs

> A product of **Adligare Tech**. Dark glass "command center" UI, fully responsive (mobile → desktop).

Every PDF tool you need, in one place — merge, split, compress, convert, sign and
protect your documents. 100% free. Every conversion happens **inside your browser**
— nothing is ever uploaded to a server unless you're signed in and choose to save it.

Built as a from-scratch PDF toolkit, with accounts, per-tool history, and an admin panel layered on top.

## Tools (28)

**Organize** — Merge PDF · Split PDF · Compress PDF · Rotate PDF · Organize PDF ·
Repair PDF · Crop PDF

**Convert** — PDF ↔ Word · PDF ↔ PowerPoint · PDF ↔ Excel · PDF ↔ JPG ·
HTML to PDF · Scan to PDF · PDF to PDF/A

**Edit & Sign** — Edit PDF · Sign PDF · Watermark · Page Numbers · OCR PDF ·
Compare PDF

**Security** — Protect PDF · Unlock PDF · Redact PDF

**Translate (new)** — Hindi ⇄ English and Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, Urdu. Type/paste text or upload PDF / DOCX / TXT; download the result as TXT, Word or PDF. Works via the backend proxy `POST /api/translate` (no API key) with direct browser fallbacks.

## Accounts, history & admin

- **Guests** can use every tool exactly as before — nothing leaves the browser, nothing is saved.
- **Signed-in users** get their output file automatically saved after each successful run.
  Every tool page shows a "Your recent files with this tool" panel (re-download or delete),
  and there's a **Dashboard** (stats + recent activity) and a full **History** page
  (search, filter by tool, delete) under the account menu.
- **Admins** get an **Admin Panel** (`/admin`) with site-wide stats, a user list (promote /
  demote / delete users), and every file saved across all users (download or delete any of them).

This is powered by a small backend in [backend/](backend) — Express + **MongoDB**
+ JWT auth (bcrypt-hashed passwords). Everything lives in MongoDB: the `users` and
`history` collections, *and* the saved files' actual bytes (via GridFS, in the
`files` bucket) — no disk storage, no separate SQL database.

You need a MongoDB server reachable at `MONGODB_URI` (default:
`mongodb://127.0.0.1:27017/e-docs` — a local install works, so does MongoDB
Atlas or any hosted Mongo). See `backend/.env.example`.

The API only answers browser requests whose `Origin` matches `FRONTEND_ORIGIN`
(default `http://localhost:5173`, comma-separate for more than one — e.g. add your
deployed frontend's URL) — everything else gets a 403. Non-browser calls (curl,
server-to-server) are unaffected, since only browsers send an `Origin` header.

**Default admin account** (seeded automatically on first run): 

```
email:    admin@e-docs.local
password: admin123
```

⚠️ Change this password (or promote your own account and delete the seed admin) before
deploying this anywhere reachable by others — `backend/src/db.js` is where it's seeded.

## Tech stack

- **Frontend**: React 19 + TypeScript + Vite, Tailwind CSS v4, React Router
- **Backend**: Express + **MongoDB** (official `mongodb` driver + GridFS) + JWT
  (`jsonwebtoken`) + `bcryptjs` + `multer`
- `pdf-lib` for PDF creation/editing, `pdfjs-dist` for rendering & text extraction
- `docx`, `mammoth`, `xlsx`, `pptxgenjs`, `jszip`, `jspdf` + `jspdf-autotable` for
  office-format conversions
- `tesseract.js` for in-browser OCR
- A hand-written PDF standard-security-handler (RC4 40/128-bit; MD5 + RC4 implemented
  from scratch and unit-tested against known vectors) powers **Protect PDF** /
  **Unlock PDF** — see `src/lib/pdfEncrypt.ts`

## Getting started

> **All frontend/backend URLs and ports live in one file: [`backend/urls.config.js`](backend/urls.config.js)**
> (`FRONTEND_PORT`, `BACKEND_PORT`, `FRONTEND_URL`, `BACKEND_URL`, `API_BASE_URL`). The Vite dev
> server, its `/api` proxy, the React app, the Express backend and the test scripts all read it.
> On a deployment host, the env vars `VITE_API_BASE`, `FRONTEND_ORIGIN` and `PORT` override it.

**Prerequisite:** a MongoDB server running and reachable (locally: install MongoDB
Community Server and make sure its service is running — Windows installs it as a
service named "MongoDB" by default. No database or collections need to be created
by hand; the app creates them the first time it connects).

```bash
npm run install:all   # installs both the frontend and backend/ dependencies
npm run dev:all       # runs the frontend (5173) and backend (8787) together
```

Or run them separately:

```bash
npm install && npm run dev        # frontend only, http://localhost:5173
npm --prefix backend install && npm run dev:backend   # backend only, http://localhost:8787
```

The Vite dev server proxies `/api/*` to the backend automatically (see `vite.config.ts`).

### Production build

```bash
npm run build     # type-check + build the frontend into dist/
npm start         # serves dist/ AND the API from one process (backend/src/index.js)
```

## Notes & limitations

- Office-format conversions (Word/Excel/PowerPoint ↔ PDF) use the backend's
  **server-side converter** (LibreOffice + Python, see below) when it is available, which
  keeps the original layout, fonts, images and tables. If it is not available (e.g. on
  Vercel) they fall back to the in-browser converters, which rebuild the document from its
  text and simplify complex layouts. For scanned/image-only PDFs, run **OCR PDF** first.
- **Protect/Unlock PDF** implement classic RC4 encryption (V1/V2, R2/R3) per
  ISO 32000-1 — broadly compatible, but PDFs protected elsewhere with AES
  (V4/V5) can't be unlocked yet.
- **Compress PDF**'s "Recommended"/"Extreme" levels rasterize pages, which is
  very effective for scans but will enlarge already-vector/text-heavy PDFs at
  low settings — use "Low compression" for those.
- Files are stored in MongoDB via GridFS in ~16MB chunks — fine well beyond typical
  PDF sizes; the 100MB per-file cap (`backend/src/routes/history.js`) is the only limit.

## High-fidelity conversion (server-side)

`POST /api/convert/:kind` (see `backend/src/routes/convert.js`) converts an uploaded file
and returns the result. No login or database needed. Kinds:

| kind | engine |
| --- | --- |
| `word-to-pdf`, `powerpoint-to-pdf`, `excel-to-pdf` | LibreOffice (headless) |
| `pdf-to-powerpoint` | LibreOffice (PDF import → editable .pptx) |
| `pdf-to-word` | `pdf2docx` (`backend/converters/pdf_to_docx.py`) |
| `pdf-to-excel` | `pdfplumber` + `openpyxl` (`backend/converters/pdf_to_xlsx.py`) |

`GET /api/convert/status` tells the frontend which kinds this server can do; each tool page
calls `convertOnServer()` (`src/lib/serverConvert.ts`) first and quietly uses its old
in-browser converter if the server can't (not installed, offline, error).

**Install the engines locally** (needed only on the machine running the backend):

- LibreOffice — `sudo apt install libreoffice-writer libreoffice-calc libreoffice-impress`
  (Windows/Mac: install from libreoffice.org and make sure `soffice` is on PATH, or set
  `SOFFICE_PATH`).
- Python 3 + `pip install pdf2docx pdfplumber openpyxl` (set `PYTHON_BIN` if it isn't `python3`,
  e.g. `python` on Windows).
- For output that looks the same as the original, install the fonts your documents use
  (Calibri/Cambria substitutes are Carlito/Caladea; Hindi needs a Devanagari font such as Noto).

**Docker (recommended for deployment):** the root `Dockerfile` bundles the app, LibreOffice,
Python libs and fonts into one image — deploy it on Render / Railway / Fly.io / a VPS.
Vercel serverless can't run LibreOffice, so there the app uses the browser fallbacks.
If the frontend stays on Vercel, deploy the backend as a Docker service and set the
frontend's `VITE_API_BASE` to it (and the backend's `FRONTEND_ORIGIN` to the Vercel URL).

Optional backend env vars: `CONVERT_MAX_MB` (50), `CONVERT_TIMEOUT_MS` (120000),
`CONVERT_CONCURRENCY` (2), `CONVERT_MAX_QUEUE` (20), `SOFFICE_PATH`, `PYTHON_BIN`.

## Deploying to Vercel

A single `vercel.json` at the project root deploys the whole app — frontend and
backend — as **one Vercel project**: the Vite build is served as static files, and
`backend/src/index.js` (the whole Express app, unmodified) runs as one serverless
function, with `/api/*` routed to it. No separate backend deployment, no CORS
headaches — same domain for both.

1. Push this repo, then "Import Project" on [vercel.com](https://vercel.com) (or `vercel` CLI from the root).
2. In the Vercel project's **Settings → Environment Variables**, set:
   - `MONGODB_URI` — a MongoDB reachable from the internet (Vercel can't reach your
     `127.0.0.1`; use [MongoDB Atlas](https://www.mongodb.com/atlas)'s free tier or similar).
   - `JWT_SECRET` — any long random string.
   - `FRONTEND_ORIGIN` — your Vercel deployment's URL once you know it (e.g.
     `https://e-docs.vercel.app`), so the API accepts requests from it. You can
     redeploy after setting this if you set it late.
   (`backend/src/env.js` skips its local-only `.env` auto-creation on Vercel — these
   three come from Vercel's dashboard instead.)
3. Deploy. Vercel builds the frontend (`npm run build` → `dist/`) and the API function together.

Note: Vercel serverless functions cap request body size (a few MB on the Hobby plan) —
very large PDF uploads to History may fail there even though the tools themselves
(which never leave the browser) are unaffected; raise this on a paid plan if needed.

### Deploying frontend & backend separately (e.g. Vercel + Render)

Two *different* env vars point at each other — set each on the host that needs it,
not the other one (see `.env.example` at the project root, and `backend/.env.example`):

- **Backend** (e.g. Render — see below) needs `FRONTEND_ORIGIN` = the frontend's URL,
  so it knows which origin to accept browser requests from (CORS).
- **Frontend** needs `VITE_API_BASE` = the backend's URL, so it knows where to actually
  send its `/api/...` calls — set this in whatever host serves the frontend (e.g.
  Vercel project → Settings → Environment Variables), as a *build-time* var (Vite
  bakes it into the build, so redeploy after changing it). Leave it unset when frontend
  and backend share one domain (local dev, or the combined single-Vercel-project setup above).

**Backend on Render (or Railway, etc.)** — a persistent-server host instead of
serverless — point it at the **`backend`** folder as the root/service directory:
- Build command: `npm install` (there's an `npm run build` script too — it's a
  no-op, some hosts require one to exist even if unused)
- Start command: `npm start`
- Environment variables: `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_ORIGIN` (see above).
  The host's own `PORT` env var is picked up automatically.

**Frontend as a static site** — root folder, build command `npm run build`, output
directory `dist`, env var `VITE_API_BASE` (see above).

## Automated tests

`scratch-tests/` has Playwright scripts exercising every tool (guest mode) and the
full auth/history/admin flow. With both dev servers running:

```bash
node scratch-tests/make-fixtures.mjs   # generates sample PDF/DOCX/XLSX/PPTX/PNG fixtures once
node scratch-tests/smoke.mjs           # all 27 tools, guest mode
node scratch-tests/auth-smoke.mjs      # signup/login, per-tool history, dashboard, admin panel
node scratch-tests/history-coverage.mjs # history-saving for every branch of the trickier tools
```
