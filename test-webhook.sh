#!/bin/bash

# Script pour tester et fixer le webhook Railway
# Usage: ./test-webhook.sh

set -e

echo "🔌 Test du webhook GitHub → Railway"
echo ""

# Vérifier que railway CLI est installé
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI non trouvé. Installation..."
    npm install -g @railway/cli
fi

# Vérifier la connexion
echo "🔐 Vérification de la connexion Railway..."
railway status || {
    echo "⚠️  Railway CLI non lié. Login..."
    railway login
}

# Créer un commit de test
echo ""
echo "📤 Création d'un commit de test..."
git commit --allow-empty -m "test: webhook deployment $(date +%s)" || true

# Pousser sur GitHub
echo "📲 Push vers GitHub..."
git push origin main

# Attendre un peu
echo "⏳ Attente (30 sec) que le webhook se déclenche..."
sleep 30

# Vérifier les déploiements
echo ""
echo "📊 Vérification de l'état du déploiement..."
railway status

echo ""
echo "✅ Test termié!"
echo "   Allez vérifier: https://railway.app/project/reasonable-enchantment"
echo ""
echo "📋 Checklist:"
echo "   [ ] Nouveau déploiement visible dans 'Deployments'"
echo "   [ ] Statut: 'In Progress' ou 'Success'"
echo "   [ ] Logs sans erreur de build"
