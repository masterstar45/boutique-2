# 🚀 Configuration du déploiement Railway

## ⚡ Setup rapide

### 1️⃣ Connecter GitHub à Railway

1. Accédez à **https://railway.app** → Votre projet **boutique-2**
2. Cliquez sur votre **Service** (ou créez-en un)
3. Allez à **Settings** → **GitHub**
4. Cliquez **"Connect GitHub"** → Autorisez Railway
5. Sélectionnez le repo: **masterstar45/boutique-2**

### 2️⃣ Activer l'auto-déploiement

1. Dans **Settings** → **Deploy**
2. Activez **"Deploy on push"** ✅
3. Sauvegardez

### 3️⃣ Ajouter les variables d'environnement

1. Allez à **Variables**
2. Ajoutez **VITE_TURNSTILE_SITE_KEY** (votre clé Cloudflare Turnstile)
3. Si vous avez d'autres vars, rajoutez-les

### 4️⃣ Tester le déploiement

- Faites un `git push` sur `main`
- Railway doit commencer le déploiement automatiquement
- Vérifiez dans **Deployments** → voir le statut

---

## 🔧 Déploiement manuel (CLI)

```bash
npm install -g @railway/cli
railway login
railway link             # Sélectionnez votre projet
railway deploy
```

---

## 📋 Checklist

- [ ] GitHub connecté à Railway
- [ ] "Deploy on push" activé
- [ ] `VITE_TURNSTILE_SITE_KEY` définie dans Variables
- [ ] Dernier commit poussé sur GitHub
- [ ] Déploiement complété (vérifier dans Railway → Deployments)

---

## 🐛 Troubleshooting

**Les commits ne se déploient pas?**
- Vérifiez que le webhook GitHub est configuré (Railway → Settings → GitHub)
- Manuellement: cliquez le bouton **Deploy** dans Railway

**Le captcha Turnstile ne s'affiche pas?**
- Vérifiez que `VITE_TURNSTILE_SITE_KEY` est dans Railway Variables
- Redéployez avec une valeur correcte

**Erreur lors du build?**
- Vérifiez les logs: Railway → Deployments → Cliquez le déploiement → Logs
