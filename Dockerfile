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

# Builder la boutique front-end
RUN PORT=3000 BASE_PATH=/ NODE_ENV=development pnpm --filter @workspace/boutique run build

# Builder le serveur API
RUN pnpm --filter @workspace/api-server run build

RUN chmod +x /app/start.sh

EXPOSE 3000

CMD ["/bin/sh", "/app/start.sh"]
