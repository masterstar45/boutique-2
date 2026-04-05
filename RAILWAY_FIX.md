# 🔧 Fix: Railway pas lié à GitHub

## Problème
Pas de section "GitHub" dans Settings = le Service n'est pas lié au repo.

---

## ✅ Solution: Créer un nouveau Service correctement

### Étape 1: Accédez à Railway
📍 **https://railway.app** → Projet **"reasonable-enchantment"**

### Étape 2: Accédez à la configuration
1. Cliquez sur le **Service** (ou créez-en un s'il y en a plusieurs)
2. Cherchez **"Source"** dans les settings
3. Vous devriez voir une option pour **"GitHub Repo"** ou **"GitHub"**

### Étape 3: Connecter GitHub
1. Cliquez sur **"GitHub Repo"** et sélectionnez votre repo:
   - Utilisateur: `masterstar45`
   - Repo: `boutique-2`
   - Branche: `main`

### Étape 4: Vérifier la configuration
1. Allez dans **"Settings"** du Service
2. Cherchez **"Deploy"** ou **"Auto Deploy"**
3. **Activez "Deploy on Push"** ✅

### Étape 5: Ajouter les variables d'env
1. Allez à **"Variables"**
2. Ajouter:
   ```
   VITE_TURNSTILE_SITE_KEY=votre_clé_ici
   PORT=3000
   BASE_PATH=/
   NODE_ENV=production
   ```

### Étape 6: Tester
1. Cliquez **"Deploy"** (bouton bleu)
2. Attendez ~10 min ⏳
3. Vérifiez les **Logs** pour les erreurs

---

## 🆘 Encore pas de section "GitHub"?

**Alternative: Utiliser Railway CLI**

```powershell
# 1. S'assurer que vous êtes loggé
railway login

# 2. Dans le repo, lier le projet
cd C:\Users\work1\boutique-2
railway link  # Sélectionnez "reasonable-enchantment"

# 3. Déployer
railway deploy
```

---

## 📋 Dernière chance: Supprimer et recréer

Si rien ne marche:

1. **Dashboard Railway** → **"reasonable-enchantment"** 
2. **Cliquez l'engrenage ⚙️** → **"Danger Zone"**
3. **"Delete Service"** → Supprimez le Service cassé
4. **"+ New Service"** → **"GitHub Repo"** → Sélectionnez `masterstar45/boutique-2`
5. Suivez les étapes ci-dessus

---

## ✅ Quand ça marche
- Vous verrez un **Deployment en cours** 🟡
- Puis **✅ Success** en vert
- L'app sera accessible via le **Domain** fourni par Railway
