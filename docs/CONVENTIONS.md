# Conventions de Marinade Web

À lire avant d'écrire un écran. Tout ce qui suit est déjà appliqué dans `src/modules/payments` et
`src/modules/auth` : ce sont les modèles de référence.

## Où écrire

- Une fonctionnalité = un dossier `src/modules/<nom>/` avec `module.ts` (routes, menu, widgets).
  Rien d'autre à enregistrer : le routeur, le menu et le tableau de bord découvrent le module.
- Dans le dossier du module :
  - `api.ts` : classe d'accès aux routes du domaine, qui dépend de l'interface `HttpClient`, et son
    instance `export const xxxApi = new XxxApi(container.http)`.
  - `types.ts` : alias des schémas OpenAPI utilisés (`components['schemas']['PlatResponse']`...),
    importés de `@/lib/api/schema`.
  - `pages/`, `components/`, `widgets/`, `composables/`, et un fichier de libellés si besoin.
- **Ne pas modifier** les fichiers partagés (`src/container.ts`, `src/lib/**`, `src/ui/**`,
  `src/stores/**`, `src/layouts/**`, `src/plugins/**`) ni les autres modules. Un composant qui
  semble générique reste dans le module ; signalez-le, il sera promu ensuite.

## Données

- Le contrat est `api/openapi.json`, les types générés sont dans `src/lib/api/schema.d.ts`. Ne jamais
  inventer un champ : lire le schéma. En cas de doute, lire le code du back
  (`D:\MITS\Projets\Marinade\app\api\v1`, `app\schemas`, `app\services`).
- Restaurant courant : `useTenantStore().currentId` (pour les routes `/{restaurant_id}/...`).
  L'en-tête `X-Tenant-ID` est ajouté automatiquement à chaque requête.
- Charger une donnée : `useAsyncData` (liste ou fiche) ; liste à curseur : `usePagedCursor` ;
  liste complète paginée en mémoire : `useClientPagination` + `AppTablePagination`.
- Envoyer un formulaire : `useSubmit` (un seul envoi à la fois, message d'erreur en français).
  Erreurs de champ : `apiError.fieldMessage('champ')`.
- Après une écriture réussie : `useToast().success('…')` puis `refresh()` de la liste (sans clignotement).
- Action destructive : `await useConfirm()({ title, text, danger: true })` avant d'appeler l'API.
- Écran qui doit bouger seul : `useLive(refresh)` (pause quand l'onglet est caché).
- Montants : `formatMoney` / `<AppMoney>`. Dates : `formatDateTime`, `formatRelative`.
  Les décimaux du back arrivent en chaînes.

## Droits

- Le front ne connaît aucun rôle, seulement les capacités du restaurant courant :
  `management`, `stock`, `front_of_house`, `cash_desk`, `production`, `reservations`.
- Chaque route et entrée de menu déclare sa `capability` (celle exigée par la route du back,
  voir `app/api/permissions.py` et les `dependencies=[Depends(perm.XXX)]`).
- Dans une page, masquer un bouton d'écriture que l'utilisateur ne peut pas utiliser :
  `useTenantStore().can('management')`.
- Pages de la plateforme : `meta: { platformAdmin: true }` et `nav.platformAdmin: true`.

## Design (Materio, couleurs Marinade)

- En-tête de page : `<AppPageHeader title subtitle>` avec les actions dans `#actions`.
- Indicateurs : `<AppStatStrip>` (bandeau en une carte) ou `<AppStatTile>` (tuile colorée).
- Listes : `VCard` > `VCardItem` (titre « Filtres » ou titre de liste) > filtres > `VDivider` >
  `VTable` (première colonne avec `VAvatar variant="tonal" rounded` + deux lignes de texte) >
  `AppTablePagination`.
- États : `<AppEmptyState icon title text>` (avec une action), `<AppErrorState :error @retry>`,
  `VSkeletonLoader` pendant le premier chargement.
- Statuts : `<AppStatusChip label tone icon>` (tones : success, warning, error, info, neutral).
- Créer / modifier : `<AppFormDialog v-model title icon :loading :error @submit>` avec les champs en slot.
  Détail d'un élément : `VNavigationDrawer location="end" temporary width="440"` (voir
  `TransactionDetailDrawer.vue`, Échap ferme).
- Téléphone : `<AppPhoneField>`. Mot de passe : `<AppPasswordField>`. Choix exclusif court : `<AppSegmented>`.
- Graphiques : `VueApexCharts` avec les couleurs de `useChartTheme()`.
- Tout le texte visible est en **français**, phrases complètes, sans jargon technique. Les valeurs
  d'énumération du back (`QUEUED`, `KITCHEN`, `confirmed`...) sont traduites dans un fichier de libellés
  du module.
- Icônes : Remix Icon, **écrites en toutes lettres** (`'ri-restaurant-line'`), jamais construites par
  concaténation, sinon elles ne sont pas embarquées.
- Accessibilité : chaque bouton icône a un `aria-label` ; lignes de tableau cliquables avec
  `tabindex="0"` et `@keydown.enter`.
- Mobile : aucune page ne doit défiler horizontalement ; colonnes secondaires masquées
  (`d-none d-md-table-cell`).

## Qualité, avant de rendre la main

```powershell
npx vue-tsc --noEmit                                   # zéro erreur dans vos fichiers
npx eslint src/modules/<nom> -c .eslintrc.cjs --ext .ts,.vue --fix
```

Puis vérifier dans le navigateur contre l'API réelle (serveur de dev sur http://127.0.0.1:5173,
compte `proprietaire@demo.marinade.test`, mot de passe `Changeme@2026`, restaurant « Chez Marinade (demo) »).
