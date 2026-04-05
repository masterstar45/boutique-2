# Boutique SOS LE PLUG - Production Build
FROM node:20-slim

ENV NODE_ENV=production

# Installer pnpm via npm (plus fiable que corepack en CI/CD)
RUN npm install -g pnpm@10.26.1

WORKDIR /app

# Copier les fichiers
COPY . .

# Installer les dépendances
RUN pnpm install --no-frozen-lockfile

# Récupérer les args de build
ARG VITE_TURNSTILE_SITE_KEY=""
ARG PORT=3000
ARG BASE_PATH=/

# Builder la boutique front-end avec les variables Vite
RUN PORT=${PORT} BASE_PATH=${BASE_PATH} NODE_ENV=production VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY} pnpm --filter @workspace/boutique run build

# Builder le serveur API
RUN pnpm --filter @workspace/api-server run build

RUN chmod +x /app/start.sh

EXPOSE 3000

CMD ["/bin/sh", "/app/start.sh"]
