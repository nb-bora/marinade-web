<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { subscriptionApi } from '../api'
import type { SubscriptionTransaction } from '../types'
import { formatDateTime } from '@/lib/format'
import { useToast } from '@/stores/toast.store'

/** La transaction affichée (celle de la ligne ou du résultat de recherche) ; `null` ferme le tiroir. */
const transaction = defineModel<SubscriptionTransaction | null>({ required: true })

const toast = useToast()
const fresh = ref<SubscriptionTransaction | null>(null)
const failed = ref(false)

const isOpen = computed({
  get: () => transaction.value !== null,
  set: open => {
    if (!open)
      transaction.value = null
  },
})

/** La ligne s'affiche tout de suite ; la version rechargée la remplace si elle arrive. */
const shown = computed(() => fresh.value ?? transaction.value)

onKeyStroke('Escape', () => {
  if (isOpen.value)
    isOpen.value = false
})

let controller: AbortController | null = null

watch(() => transaction.value?.id, async id => {
  controller?.abort()
  fresh.value = null
  failed.value = false

  if (!id)
    return

  const current = new AbortController()

  controller = current

  try {
    const result = await subscriptionApi.transaction(id, current.signal)

    if (!current.signal.aborted)
      fresh.value = result
  }
  catch {
    if (!current.signal.aborted)
      failed.value = true
  }
}, { immediate: true })

onScopeDispose(() => controller?.abort())

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.info(done)
  }
  catch {
    toast.warning('Copie impossible : sélectionnez le texte à la main.')
  }
}
</script>

<template>
  <VNavigationDrawer
    v-model="isOpen"
    location="end"
    temporary
    width="440"
    aria-label="Détail de la transaction"
  >
    <div class="d-flex align-center justify-space-between pa-4 pb-2">
      <h2 class="text-h6">
        Transaction
      </h2>
      <IconBtn
        aria-label="Fermer"
        @click="isOpen = false"
      >
        <VIcon icon="ri-close-line" />
      </IconBtn>
    </div>

    <div
      v-if="shown"
      class="px-4 pb-6"
    >
      <div class="d-flex align-center justify-space-between gap-3 mb-1">
        <AppStatusChip
          label="Consommé sur le plafond"
          tone="info"
          icon="ri-wallet-3-line"
        />
        <span class="text-body-2 text-medium-emphasis">{{ formatDateTime(shown.created_at) }}</span>
      </div>

      <div class="text-h4 font-weight-semibold my-3">
        <AppMoney :amount="shown.amount_fcfa" />
      </div>

      <VAlert
        v-if="failed"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-4"
      >
        Impossible d'actualiser cette transaction : les informations affichées viennent de la liste.
      </VAlert>

      <VList
        density="compact"
        class="pa-0 bg-transparent"
      >
        <VListItem class="px-0">
          <VListItemSubtitle>Description</VListItemSubtitle>
          <VListItemTitle class="text-wrap">
            {{ shown.description || 'Aucune description' }}
          </VListItemTitle>
        </VListItem>
        <VListItem
          v-if="shown.pos_transaction_id"
          class="px-0"
        >
          <VListItemSubtitle>Identifiant du terminal de paiement</VListItemSubtitle>
          <VListItemTitle class="text-wrap font-mono">
            {{ shown.pos_transaction_id }}
            <IconBtn
              size="x-small"
              aria-label="Copier l'identifiant du terminal"
              @click="copy(shown.pos_transaction_id!, 'Identifiant copié.')"
            >
              <VIcon
                icon="ri-file-copy-line"
                size="16"
              />
            </IconBtn>
          </VListItemTitle>
        </VListItem>
        <VListItem class="px-0">
          <VListItemSubtitle>Numéro de la transaction</VListItemSubtitle>
          <VListItemTitle class="text-wrap font-mono">
            {{ shown.id }}
            <IconBtn
              size="x-small"
              aria-label="Copier le numéro de la transaction"
              @click="copy(shown.id, 'Numéro copié.')"
            >
              <VIcon
                icon="ri-file-copy-line"
                size="16"
              />
            </IconBtn>
          </VListItemTitle>
        </VListItem>
      </VList>
    </div>
  </VNavigationDrawer>
</template>

<style scoped>
.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  word-break: break-all;
}
</style>
