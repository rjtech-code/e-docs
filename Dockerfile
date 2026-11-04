# One image that runs the whole app (API + built frontend) WITH the conversion engines
# (LibreOffice + Python) and Chromium for high-fidelity webpage-to-PDF rendering.
# Deploy this on a Docker-capable host (Render, Railway, Fly.io, a VPS...). Vercel's
# serverless functions cannot run system Chromium or LibreOffice reliably.

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

# Chromium + LibreOffice + Python conversion tools. Fonts matter for layout fidelity;
# Noto covers Hindi (Devanagari) and other Indian scripts, plus emoji.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
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
# The root project already installs Playwright as a build dependency. Copy its runtime
# packages into the final image so the backend can launch the system Chromium binary.
COPY --from=web /app/node_modules/playwright /app/node_modules/playwright
COPY --from=web /app/node_modules/playwright-core /app/node_modules/playwright-core
COPY --from=web /app/dist /app/dist

ENV NODE_ENV=production
ENV CHROMIUM_PATH=/usr/bin/chromium
EXPOSE 8787
CMD ["node", "src/index.js"]
