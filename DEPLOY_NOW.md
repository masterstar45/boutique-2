# 🚨 SOLUTION D'URGENCE: Redéployer maintenant

Si le webhook ne marche pas, **voici comment redéployer en 1 minute**.

## ⚡ Solution 1: Via Railway Dashboard (le plus simple)

1. Allez sur **https://railway.app**
2. Sélectionnez votre projet **"reasonable-enchantment"**
3. Onglet **"Deployments"**
4. Cliquez le gros bouton **"Deploy"** (bleu) en haut
5. Attendez ~10 min ⏳

**C'est tout!** La dernière version de GitHub sera déployée.

---

## ⚡ Solution 2: Via Railway CLI (si vous avez un terminal)

```powershell
cd C:\Users\work1\boutique-2
railway deploy --service boutique-2
```

Railway va se connecter, récupérer le dernier code, et déployer.

---

## 🔧 Solution 3: Fixer le webhook Wikipedia (pour l'avenir)

Si c'est toujours bloqué:

### Étape A: Vérifier le webhook
- GitHub: **https://github.com/masterstar45/boutique-2/settings/hooks**
- Railway webhook doit exister (api.railway.app/webhooks/github)
- Cliquez dessus → "Recent Deliveries" → Cherchez les ❌ erreurs

### Étape B: Recréer le webhook si cassé
1. Railway Dashboard → Service → Settings
2. Scroll vers **"GitHub"** ou **"Source"**
3. Déconnectez: `masterstar45/boutique-2`
4. Reconnectez-le
5. Assurez-vous que **"Deploy on Push" est EN VERT** ✅

### Étape C: Tester
```powershell
git commit --allow-empty -m "test"
git push origin main
```
Attendre 30 sec → Vérifier Dashboard

---

## 📋 Récapitulatif: Qu'est-ce qui a été fait

✅ **Code fixé:**
- Turnstile captcha fonctionne sur /admin
- Variables d'env correctement configurées au build

✅ **Déploiement documenté:**
- RAILWAY_DEPLOYMENT.md
- WEBHOOK_SETUP.md
- WEBHOOK_DEBUG.md
- RAILWAY_FIX.md

✅ **Scripts fournis:**
- deploy-railway.sh
- test-webhook.sh

✅ **Tout poussé sur GitHub** (commits: 4f49068, 040f3e7, fa8dad0, c847d34, 1a34f7a, fb1dcba, 38e6976)

---

## 🎯 Suivant: Manuellement redéployer

**Le plus rapide: Cliquez "Deploy" dans Railway Dashboard** → Attendez

Si problème persiste → Ouvrir issue GitHub ou contacter support Railway
