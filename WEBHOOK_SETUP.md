# 🔗 Configuration du webhook GitHub → Railway

Railway n'a pas reçu votre dernier push car **le webhook GitHub n'est pas activé**.

## ⚡ Solution rapide (5 min)

### Étape 1: Aller au dashboard Railway
📍 **https://railway.app** → Sélectionnez **"reasonable-enchantment"**

### Étape 2: Configurer la connexion GitHub
1. Cliquez sur **"Settings"** (roue ⚙️)
2. Allez à **"GitHub"**
3. Cherchez la section **"GitHub Repo"**
4. Cliquez sur **"Connect GitHub"** (si pas encore fait)
5. Sélectionnez: **masterstar45/boutique-2**

### Étape 3: Activer "Deploy on Push"
1. Toujours dans **Settings**
2. Cherchez l'option **"Deploy on Push"** ou **"Auto Deploy"**
3. **Activez-la** ✅
4. Cliquez **"Save"**

### Étape 4: Forcer un test
1. Allez à **"Deployments"**
2. Cliquez le bouton **"Deploy"** (bleu, en haut)
3. Attendez 5-10 min ⏳

---

## ✅ Vérifier que ça marche
1. Attendez la fin du déploiement (✅ Success)
2. Cherchez le **Domain** (URL de votre app)
3. Visitez l'URL → Vous devriez voir votre boutique ! 🎉

---

## 🆘 Ça marche toujours pas?
- Vérifiez que le **"Service"** dans Railway est bien lié à ce **repo GitHub**
- Vérifiez que vous utilisez la branche **"main"** (pas "master")
- Consultez les **Logs** du déploiement pour les erreurs de build

---

## 📋 Checklist finale
- [ ] GitHub connecté ✅
- [ ] "Deploy on Push" activé ✅
- [ ] `VITE_TURNSTILE_SITE_KEY` définie dans Variables ✅
- [ ] Dernier commit: `1a34f7a` poussé ✅
- [ ] Déploiement en cours ou terminé ✅
