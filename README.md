# Marinade Web

Interface web de [Marinade](../Marinade) : tableau de bord du restaurant, historique des paiements Mobile Money,
compte et sécurité. Vue 3, Vuetify 3, Pinia, TypeScript strict, typée de bout en bout par le contrat OpenAPI de l'API.

## Sommaire

- [Démarrer](#démarrer)
- [Comptes de démonstration](#comptes-de-démonstration)
- [Architecture](#architecture)
- [Ajouter une fonctionnalité](#ajouter-une-fonctionnalité)
- [Droits et multi-restaurant](#droits-et-multi-restaurant)
- [Contrat avec l'API](#contrat-avec-lapi)
- [Qualité](#qualité)
- [Production](#production)

## Démarrer

Prérequis : Node 20+, Yarn 1, l'API Marinade lancée et migrée.

```powershell
yarn install
copy .env.example .env.local     # puis ajuster MARINADE_API_URL
yarn dev                         # http://localhost:5173
```

Le navigateur ne parle qu'au serveur de développement, qui relaie `/api/*` vers l'API (`MARINADE_API_URL`) :
aucune configuration CORS n'est nécessaire.

| Commande | Rôle |
|---|---|
| `yarn dev` | Serveur de développement |
| `yarn build` | Contrôle de types puis build de production dans `dist/` |
| `yarn typecheck` | Contrôle de types seul (`vue-tsc`) |
| `yarn test` | Tests unitaires (Vitest) |
| `yarn lint` | ESLint avec correction automatique |
| `yarn gen:api` | Régénère les types depuis `api/openapi.json` |

## Comptes de démonstration

Depuis le dossier de l'API :

```powershell
.\venv\Scripts\python.exe -m scripts.seed_demo --with-payments
```

Le script affiche les comptes créés (super-admin, propriétaire, manager, caissier, serveur, chef, barman, et un
restaurant concurrent pour vérifier l'isolation) et leur mot de passe commun. `--reset` repart de zéro.

## Architecture

```
src/
├── container.ts          Racine de composition : seul endroit qui assemble les implémentations
├── api/                  Un dépôt par domaine de l'API (auth, compte, paiements)
├── lib/                  Infrastructure sans interface graphique
│   ├── api/              schema.d.ts (GÉNÉRÉ) et types.ts (noms stables)
│   ├── http/             HttpClient (interface), FetchHttpClient, erreurs normalisées, messages FR
│   ├── auth/             Jetons, en-têtes Authorization / X-Tenant-ID, rafraîchissement du jeton
│   ├── module/           Contrat d'un module et registre (routes, menu, widgets)
│   ├── router/           Gardes d'accès et chemins du noyau
│   ├── format.ts         Monnaie (FCFA), dates, durées relatives, en français
│   └── validation.ts     Règles de formulaire
├── stores/               session (qui est connecté), tenant (restaurant courant, droits), toast
├── composables/          useCursorList (pagination par curseur), useLive, useSubmit, useConfirm
├── ui/                   Composants génériques App* (enregistrés automatiquement)
├── layouts/              Mise en page avec menu, mise en page vide
├── modules/              Une fonctionnalité par dossier (voir ci-dessous)
├── @core, @layouts       Moteur de mise en page et SCSS hérités du template Materio
└── plugins/              Vuetify (thème, français), routeur, Pinia, icônes
```

Principes appliqués :

- **Dépendances inversées** : stores et dépôts dépendent de l'interface `HttpClient`, jamais de `fetch`. Les tests
  injectent un faux `fetch` ou un `MemoryTokenStore`.
- **Responsabilité unique** : le client HTTP transporte, les décorateurs ajoutent les en-têtes, `SessionRefresher`
  rétablit la session, les stores tiennent l'état, les pages assemblent.
- **Ouvert à l'extension** : le routeur, le menu et le tableau de bord sont *bâtis* à partir des modules découverts.
  Ajouter un écran ne modifie aucun fichier existant.

Détails qui comptent :

- **Rafraîchissement du jeton en un seul vol.** Le jeton de rafraîchissement du back est à usage unique ; plusieurs
  requêtes qui reçoivent un 401 en même temps attendent le même renouvellement, puis rejouent une fois.
- **Listes en direct sans saut.** `useCursorList.refreshHead()` met à jour la tête de liste (nouveaux paiements,
  statuts qui changent) sans perdre les pages déjà déroulées ; l'actualisation s'arrête quand l'onglet est caché.
- **Requêtes périmées annulées.** Changer de filtre annule la requête précédente : une réponse lente n'écrase jamais
  une réponse plus récente.
- **Icônes à la demande.** `build-icons.ts` n'embarque que les icônes Remix citées dans le code (environ 25 Ko au lieu
  de 1,5 Mo). Une icône s'écrit toujours en toutes lettres (`'ri-home-line'`).
- **Police auto-hébergée** (`@fontsource/inter`) : aucune requête vers un tiers.

## Ajouter une fonctionnalité

Créer `src/modules/<nom>/module.ts` :

```ts
import { defineFeature } from '@/lib/module/types'

export default defineFeature({
  id: 'stock',
  routes: [
    { path: '/stock', component: () => import('./pages/StockPage.vue'), meta: { title: 'Stock', capability: 'stock' } },
  ],
  nav: [
    { id: 'stock', title: 'Stock', icon: 'ri-stack-line', to: '/stock', section: 'catalog', capability: 'stock' },
  ],
  widgets: [
    { id: 'stock-alerts', component: () => import('./widgets/StockAlerts.vue'), width: 6, capability: 'stock' },
  ],
})
```

C'est tout : la route est protégée, l'entrée apparaît dans la bonne section du menu pour ceux qui ont le droit, et le
widget s'affiche sur le tableau de bord. Les sections du menu sont déclarées dans `lib/module/types.ts`.

Méta-données de route : `title`, `layout` (`blank` pour une page sans menu), `public`, `guestOnly`,
`withoutRestaurant`, `capability`, `platformAdmin`.

## Droits et multi-restaurant

Le front ne connaît **aucun rôle**. À la connexion, il lit `GET /v1/users/me/access`, qui renvoie les restaurants de
l'utilisateur et, pour chacun, ses **capacités** calculées par la politique d'accès du serveur :

| Capacité | Ouvre |
|---|---|
| `management` | Carte, prix, recettes, plan de salle, remboursements |
| `stock` | Mouvements de stock, approvisionnement |
| `front_of_house` | Prise de commande, sessions de table |
| `cash_desk` | Encaissement, caisse, historique des paiements |
| `production` | Écrans cuisine et bar |
| `reservations` | Réservations et liste d'attente |

Le restaurant choisi part dans l'en-tête `X-Tenant-ID` de chaque requête : c'est lui qui borne la sécurité au niveau
des lignes (RLS) côté base. Changer de restaurant remonte la page, qui recharge ses données ; le choix est retenu
par utilisateur. Le menu, les gardes de route et les widgets filtrent tous sur ces capacités ; le serveur reste
l'autorité et refuse de toute façon ce qui n'est pas permis.

## Contrat avec l'API

`api/openapi.json` est exporté par le back ; les types en sont générés. Après une évolution de l'API :

```powershell
cd ..\Marinade
.\venv\Scripts\python.exe -m scripts.export_openapi ..\Marinade-web\api\openapi.json
cd ..\Marinade-web
yarn gen:api
yarn typecheck      # signale tout appel devenu incompatible
```

Les erreurs du back (trois formats : `detail` texte, validation Pydantic, exceptions métier) sont normalisées en
`ApiError` ; l'utilisateur ne voit que des messages français (`lib/http/errorMessages.ts`), jamais le texte anglais
du serveur.

## Qualité

- `yarn typecheck` : zéro erreur, TypeScript strict.
- `yarn lint` : zéro erreur, configuration du projet.
- `yarn test` : 51 tests unitaires (erreurs, client HTTP et rafraîchissement concurrent, gardes, menu par droits,
  pagination en direct, protection contre la redirection ouverte).
- Parcours de bout en bout vérifié dans Edge contre l'API réelle : connexion et message d'erreur, tableau de bord,
  historique, filtre, recherche par préfixe, détail, session après rechargement, accès refusé au serveur, isolation
  entre deux restaurants, changement de restaurant par l'administrateur, affichage mobile sans défilement horizontal.

## Production

```powershell
yarn build
```

Servir `dist/` en renvoyant toute route inconnue vers `index.html` (application monopage), et relayer `/api/` vers
l'API, par exemple avec nginx :

```nginx
location /api/ { proxy_pass http://127.0.0.1:8000/; proxy_set_header Host $host; }
location /     { try_files $uri /index.html; }
```

Le WebSocket des écrans cuisine passe par le même préfixe (`proxy_http_version 1.1` et en-têtes `Upgrade` /
`Connection` à ajouter quand ces écrans seront livrés).
