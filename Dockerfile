# Boutique PharmacyHash - Production Build
FROM node:20-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_INTEGRITY_KEYS=0
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile=false

RUN PORT=3000 BASE_PATH=/ NODE_ENV=development pnpm --filter @workspace/boutique run build

RUN pnpm --filter @workspace/api-server run build

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3000

CMD ["/bin/sh", "/app/start.sh"]
