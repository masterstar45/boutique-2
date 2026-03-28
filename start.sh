#!/bin/sh

echo "🗄️  Migration base de données..."
pnpm --filter @workspace/db run push --force 2>&1 || echo "⚠️  Migration ignorée"

echo "🚀 Démarrage du serveur..."
exec node --enable-source-maps /app/artifacts/api-server/dist/index.mjs
