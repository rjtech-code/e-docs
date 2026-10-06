# One image that runs the whole app (API + built frontend) WITH the conversion engines
# (LibreOffice + Python libs) that high-fidelity Word/PowerPoint/Excel <-> PDF needs.
# Deploy this on a Docker-capable host (Render, Railway, Fly.io, a VPS...). Vercel's
# serverless functions cannot run LibreOffice — there the app falls back to its in-browser
# converters automatically.

# ---- 1) build the frontend ----
FROM node:20-bookworm-slim AS web
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 2) runtime ----
FROM node:20-bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive

# LibreOffice (only the modules we need) + Python for pdf2docx / pdfplumber.
# Fonts matter for "same-to-same" output: Carlito/Caladea are metric-compatible with
# Calibri/Cambria, Liberation with Arial/Times/Courier, Noto covers Hindi (Devanagari)
# and other Indian scripts, plus emoji.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer libreoffice-calc libreoffice-impress libreoffice-draw \
      python3 python3-pip \
      fonts-liberation fonts-dejavu-core fonts-crosextra-carlito fonts-crosextra-caladea \
      fonts-noto-core fonts-noto-ui-core fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --no-cache-dir --break-system-packages pdf2docx pdfplumber openpyxl \
    && fc-cache -f

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
COPY --from=web /app/dist /app/dist

# The port comes from backend/urls.config.js (BACKEND_PORT) unless the host sets PORT.
# EXPOSE is only documentation for Docker — keep it equal to BACKEND_PORT.
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "src/index.js"]
