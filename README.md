# Forex Terminal

Terminal d'aide à la décision, sans exécution automatique sur MT5.

## Structure obligatoire

```text
api/
  analyze.js
  market.js
index.html
package.json
vercel.json
README.md
```

## Variables à ajouter dans Vercel

- `TWELVE_DATA_API_KEY` : clé Twelve Data
- `ANTHROPIC_API_KEY` : clé Anthropic
- `ANTHROPIC_MODEL` : facultatif. Par défaut : `claude-sonnet-4-20250514`

## Déploiement

1. Décompresser le ZIP dans l'app Fichiers de l'iPhone.
2. Créer un dépôt GitHub vide, sans README automatique.
3. Ajouter `index.html`, `package.json`, `vercel.json` et `README.md` à la racine.
4. Créer le dossier `api` sur GitHub en créant successivement les fichiers `api/market.js` et `api/analyze.js`.
5. Importer le dépôt dans Vercel.
6. Ajouter les variables d'environnement dans Vercel, puis redéployer.

Le terminal affiche BUY ou SELL uniquement pour les setups notés 4/5 ou 5/5. En dessous, il affiche WAIT.
