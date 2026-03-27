#!/bin/sh
set -e

echo "🗄️  Initialisation de la base de données..."
pnpm --filter @workspace/db run push --force 2>&1 || echo "⚠️  Migration ignorée (DB peut être déjà à jour)"

echo "🚀 Démarrage du serveur..."
exec node --enable-source-maps /app/artifacts/api-server/dist/index.mjs
