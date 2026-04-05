# 🔌 Fix: Le Webhook GitHub ne fonctionne pas

## Problème
- "Deploy on Push" est activé ✅
- Mais aucun déploiement récent ne se fait 😞
- = Le webhook GitHub n'envoie pas les notifications

---

## ✅ Solution en 3 étapes

### Étape 1: Vérifier le webhook sur GitHub

1. Allez sur **https://github.com/masterstar45/boutique-2/settings/hooks**
2. Vous devriez voir un webhook Railway
3. **Si le webhook n'existe pas**: Allez à l'Étape 2
4. **Si le webhook existe**: Vérifiez sa **dernière livraison**
   - Cliquez sur le webhook
   - Onglet **"Recent Deliveries"**
   - Cherchez votre dernier push
   - S'il y a une ❌ **erreur**, cliquez dessus pour voir le message

### Étape 2: Recréer le webhook (si bloqué)

**Méthode A: Via Railway Desktop**
1. Dashboard Railway → Service → Settings
2. Cliquez **"GitHub Repo"** → Déconnecter
3. Reconnectez le repo:
   - Repo: `masterstar45/boutique-2`
   - Branche: `main`
   - "Deploy on Push": ✅ Activé

**Méthode B: Forcer via Railway CLI**
```powershell
cd C:\Users\work1\boutique-2
railway up  # Ré-synchro
```

### Étape 3: Faire un test push

```powershell
cd C:\Users\work1\boutique-2
git commit --allow-empty -m "test: trigger Railway webhook"
git push origin main
```

Attendez 30 secondes, puis vérifiez:
- Dashboard Railway → **Deployments**
- Vous devriez voir un **nouveau déploiement** 🟡

---

## 🔍 Vérifier le webhook GitHub manuellement

Allez sur **GitHub → masterstar45/boutique-2 → Settings → Webhooks**

Cherchez Railroad/Railway webhook. Devrait ressembler à:
```
https://api.railway.app/webhooks/github
```

Si elle n'existe pas = **Recreation nécessaire**

---

## 🆘 Toujours pas de déploiement?

**Solution nucléaire: Redéploiement manuel**

```powershell
cd C:\Users\work1\boutique-2
railway login
railway serve  # Voir les logs en direct
```

Ou sur le dashboard:
1. Railway → Deployments
2. Bouton **"Deploy"** (bleu) → Cliquez
3. Attendez 10 min
