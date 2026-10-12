import type { Ref } from 'vue'
import type { Restaurant } from '../types'

/** Brouillons non enregistrés, conservés sur l'appareil : `{ [restaurant]: { [onglet]: brouillon } }`. */
export const DRAFT_STORAGE_KEY = 'marinade.settings.draft'

type Store = Record<string, Record<string, unknown>>

function readStore(): Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) ?? '{}')

    return typeof parsed === 'object' && parsed !== null ? parsed as Store : {}
  }
  catch {
    return {}
  }
}

function writeStore(store: Store) {
  try {
    if (Object.keys(store).length === 0)
      localStorage.removeItem(DRAFT_STORAGE_KEY)
    else
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(store))
  }
  catch {
    // Stockage indisponible (navigation privée, quota) : le brouillon reste en mémoire seulement.
  }
}

const readDraft = (restaurantId: string, scope: string) => readStore()[restaurantId]?.[scope] ?? null

function writeDraft(restaurantId: string, scope: string, value: unknown) {
  const store = readStore()

  if (value === null) {
    delete store[restaurantId]?.[scope]
    if (store[restaurantId] && Object.keys(store[restaurantId]).length === 0)
      delete store[restaurantId]
  }
  else {
    store[restaurantId] = { ...store[restaurantId], [scope]: value }
  }

  writeStore(store)
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Brouillon d'un onglet : valeurs saisies, indicateur de modification, champs modifiés, et copie
 * dans `localStorage` (clé `marinade.settings.draft`) tant que rien n'est enregistré.
 *
 * - Un restaurant rechargé (enregistrement d'un autre onglet) ne remplace que les champs que
 *   l'utilisateur n'a pas touchés : une saisie en cours n'est jamais perdue.
 * - `snapshot` donne la forme comparée (par défaut, le brouillon lui-même).
 */
export function useSettingsDraft<T extends Record<string, unknown>>(
  scope: string,
  getRestaurant: () => Restaurant,
  draftOf: (restaurant: Restaurant) => T,
  snapshot: (draft: T) => unknown = value => value,
) {
  const restored = ref(false)

  function initial(restaurant: Restaurant): T {
    const base = draftOf(restaurant)
    const stored = readDraft(restaurant.id, scope)

    const merged = stored !== null && typeof stored === 'object' ? { ...base, ...(stored as Partial<T>) } : base

    restored.value = !same(snapshot(merged), snapshot(base))

    return restored.value ? merged : base
  }

  const draft = ref(initial(getRestaurant())) as Ref<T>
  const baseline = computed(() => draftOf(getRestaurant()))
  const dirty = computed(() => !same(snapshot(draft.value), snapshot(baseline.value)))

  watch(getRestaurant, (restaurant, previous) => {
    if (restaurant.id !== previous?.id) {
      draft.value = initial(restaurant)

      return
    }

    const before = draftOf(previous)
    const after = draftOf(restaurant)
    const next = { ...draft.value } as Record<string, unknown>

    for (const key of Object.keys(after)) {
      if (same(draft.value[key], before[key]))
        next[key] = after[key]
    }

    draft.value = next as T
    restored.value = false
  })

  // Copie locale : présente seulement tant que le brouillon diffère du serveur.
  watch([draft, baseline], () => {
    writeDraft(getRestaurant().id, scope, dirty.value ? draft.value : null)
  }, { deep: true })

  const changed = (key: keyof T) => !same(draft.value[key], baseline.value[key])
  const changedKeys = computed(() => (Object.keys(baseline.value) as Array<keyof T>).filter(changed))

  function discard() {
    draft.value = draftOf(getRestaurant())
    restored.value = false
  }

  return { draft, dirty, changed, changedKeys, restored, discard }
}
