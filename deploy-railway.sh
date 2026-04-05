#!/bin/bash

# Script de déploiement sur Railway
# Usage: ./deploy-railway.sh

set -e

echo "🚀 Déploiement sur Railway..."

# Vérifier que railway CLI est installé
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI non trouvé. Installation..."
    npm install -g @railway/cli
fi

# Vérifier que on est sur main et à jour
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Vous êtes sur la branche: $CURRENT_BRANCH"
    read -p "Continuer quand même? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Vérifier qu'il n'y a pas de changements non committés
if ! git diff-index --quiet HEAD --; then
    echo "❌ Vous avez des changements non committés. Committez d'abord."
    exit 1
fi

# Pousser sur GitHub
echo "📤 Poussage vers GitHub..."
git push origin main

# Redéployer sur Railway
echo "🔄 Redéploiement sur Railway..."
railway deploy

echo "✅ Déploiement terminé!"
echo "📊 Vérifiez le statut sur: https://railway.app"
