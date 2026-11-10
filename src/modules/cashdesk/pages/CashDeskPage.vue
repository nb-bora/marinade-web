<script setup lang="ts">
import SessionTile from '../components/SessionTile.vue'
import ShiftDialogs from '../components/ShiftDialogs.vue'
import { useCashSessions } from '../composables/useCashSessions'
import { useShift } from '../composables/useShift'
import { METHODS, METHOD_ORDER, plural } from '../labels'
import { toNumber } from '../money'
import type { Shift } from '../types'
import { useLive } from '@/composables/useLive'
import { useSubmit } from '@/composables/useSubmit'
import { formatDateTime, formatMoney, formatTime } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const router = useRouter()
const toast = useToast()
const tenant = useTenantStore()

const shift = useShift()
const { toCollect, withoutOrder, totalDue, error, rows, reload, refresh } = useCashSessions()

// Le shift (et son bilan) se relit avec les sessions : un shift ouvert ou fermé depuis un autre appareil
// apparaît tout seul. Le premier tour part dès l'ouverture de l'écran.
const { isLive } = useLive(() => Promise.all([refresh(), shift.sync()]))

watch(() => tenant.currentId, () => shift.sync())

// L'heure sert aux « il y a 5 minutes » : on la rafraîchit avec les données.
const now = ref(new Date())

watch(rows, () => {
  now.value = new Date()
})

const openDialog = ref(false)
const closeDialog = ref(false)
const resultDialog = ref(false)
const closedShift = ref<Shift | null>(null)

const { submit: openShift, pending: opening, message: openMessage, reset: resetOpen } = useSubmit(async (balance: number) => {
  const outcome = await shift.open(balance)

  openDialog.value = false
  if (outcome === 'opened')
    toast.success('La caisse est ouverte. Bon service !')
  else
    toast.info('Un shift est déjà ouvert pour vous : vous pouvez encaisser.')
})

const { submit: closeShift, pending: closing, message: closeMessage, reset: resetClose } = useSubmit(async (counted: number) => {
  closedShift.value = await shift.close(counted)
  closeDialog.value = false
  resultDialog.value = true
})

watch(openDialog, () => resetOpen())
watch(closeDialog, () => resetClose())

const loadedOnce = computed(() => rows.value !== null)

// Shift ----------------------------------------------------------------------------------------

const shiftHint = computed(() => {
  if (shift.shift.value && shift.isOpen.value)
    return `Ouverte depuis ${formatTime(shift.shift.value.opened_at)}`
  if (shift.isOpen.value)
    return 'Ouverte sur un autre appareil'

  return 'À ouvrir avant d\'encaisser'
})

const report = computed(() => shift.summary.value)

const orderOf = (method: string) => {
  const index = (METHOD_ORDER as string[]).indexOf(method)

  return index === -1 ? METHOD_ORDER.length : index
}

/** Encaissements du shift par moyen de paiement, dans l'ordre d'affichage habituel (moyens inconnus à la fin). */
const byMethod = computed(() => Object.entries(report.value?.payments_by_method ?? {})
  .filter(([, entry]) => entry.count > 0)
  .sort(([a], [b]) => orderOf(a) - orderOf(b))
  .map(([method, entry]) => {
    const known = (METHODS as Record<string, (typeof METHODS)[keyof typeof METHODS] | undefined>)[method]

    return {
      method,
      label: known?.label ?? method,
      icon: known?.icon ?? 'ri-wallet-3-line',
      color: known?.color ?? 'secondary',
      count: entry.count,
      total: toNumber(entry.total),
    }
  }))

const collected = computed(() => toNumber(report.value?.payments_total))

const gap = computed(() => shift.lastClosed.value ? toNumber(shift.lastClosed.value.variance) : 0)

const goTo = (sessionId: string) => router.push(`/caisse/sessions/${sessionId}`)

const reloading = ref(false)

async function reloadAll() {
  reloading.value = true
  try {
    await Promise.all([reload(), shift.sync()])
  }
  finally {
    reloading.value = false
  }
}
</script>

<template>
  <div>
    <AppHero
      eyebrow="Finance"
      title="Caisse"
      subtitle="Ouvrez votre shift, encaissez les additions et fermez la caisse en fin de service."
      :live="isLive"
    >
      <template #eyebrow-extra>
        · {{ shift.isOpen.value ? shiftHint : 'Caisse fermée' }}
      </template>
      <template #actions>
        <IconBtn
          aria-label="Actualiser la caisse"
          :loading="reloading"
          @click="reloadAll"
        >
          <VIcon icon="ri-refresh-line" />
        </IconBtn>
        <VBtn
          v-if="!shift.isOpen.value"
          color="primary"
          size="large"
          prepend-icon="ri-lock-unlock-line"
          @click="openDialog = true"
        >
          Ouvrir la caisse
        </VBtn>
        <VBtn
          v-else
          color="error"
          variant="outlined"
          size="large"
          prepend-icon="ri-lock-line"
          @click="closeDialog = true"
        >
          Fermer la caisse
        </VBtn>
      </template>
    </AppHero>

    <AppMetricGrid class="mt-5 mb-6">
      <AppMetricTile
        hero
        label="À encaisser"
        icon="ri-hand-coin-line"
        :hint="toCollect.length ? `${plural(toCollect.length, 'addition')} en attente` : 'Aucune addition en attente'"
      >
        <AppAnimatedNumber
          v-slot="{ current }"
          :value="totalDue"
        >
          {{ formatMoney(current) }}
        </AppAnimatedNumber>
      </AppMetricTile>
      <AppMetricTile
        label="Caisse"
        :icon="shift.isOpen.value ? 'ri-lock-unlock-line' : 'ri-lock-line'"
        :color="shift.isOpen.value ? 'success' : 'warning'"
        :hint="shiftHint"
      >
        {{ shift.isOpen.value ? 'Ouverte' : 'Fermée' }}
      </AppMetricTile>
      <AppMetricTile
        label="Fond de caisse"
        icon="ri-safe-2-line"
        color="secondary"
        :hint="shift.shift.value ? `Compté à ${formatTime(shift.shift.value.opened_at)}` : 'Aucun shift ouvert'"
      >
        {{ shift.shift.value ? formatMoney(shift.shift.value.opening_balance) : '—' }}
      </AppMetricTile>
      <AppMetricTile
        label="Encaissé ce shift"
        icon="ri-money-dollar-circle-line"
        color="info"
        :hint="report ? plural(report.payments_count, 'paiement') : 'Disponible à l\'ouverture'"
      >
        {{ report ? formatMoney(collected) : '—' }}
      </AppMetricTile>
    </AppMetricGrid>

    <VAlert
      v-if="shift.lastClosed.value"
      :type="gap === 0 ? 'success' : 'warning'"
      variant="tonal"
      class="mb-6"
      closable
      @click:close="shift.dismissLastClosed"
    >
      <div class="font-weight-medium">
        Dernier shift fermé le {{ formatDateTime(shift.lastClosed.value.closed_at) }}
      </div>
      <template v-if="gap === 0">
        La caisse était juste, aucun écart.
      </template>
      <template v-else-if="gap < 0">
        Il manquait {{ formatMoney(Math.abs(gap)) }} : attendu {{ formatMoney(shift.lastClosed.value.closing_balance_expected) }},
        compté {{ formatMoney(shift.lastClosed.value.closing_balance_counted) }}.
      </template>
      <template v-else>
        Il y avait {{ formatMoney(gap) }} de plus que prévu : attendu {{ formatMoney(shift.lastClosed.value.closing_balance_expected) }},
        compté {{ formatMoney(shift.lastClosed.value.closing_balance_counted) }}.
      </template>
    </VAlert>

    <VAlert
      v-if="!shift.isOpen.value"
      type="info"
      variant="tonal"
      class="mb-6"
      icon="ri-information-line"
    >
      Aucun shift n'est ouvert. Vous pouvez encaisser, mais les espèces ne seront comptées dans la caisse qu'à partir de l'ouverture.
    </VAlert>

    <section
      v-if="byMethod.length"
      class="shift-methods mb-6"
      aria-label="Encaissements du shift par moyen de paiement"
    >
      <h2 class="shift-methods__title">
        Encaissé par moyen de paiement
      </h2>
      <ul class="shift-methods__list">
        <li
          v-for="item in byMethod"
          :key="item.method"
          class="shift-methods__item"
          :style="{ '--method': `var(--v-theme-${item.color})` }"
        >
          <span class="shift-methods__icon">
            <VIcon
              :icon="item.icon"
              size="20"
            />
          </span>
          <span class="min-w-0">
            <span class="shift-methods__label">{{ item.label }}</span>
            <span class="shift-methods__amount tabular-nums text-no-wrap">{{ formatMoney(item.total) }}</span>
            <span class="shift-methods__count">{{ plural(item.count, 'paiement') }}</span>
          </span>
        </li>
      </ul>
    </section>

    <div class="d-flex flex-wrap align-center justify-space-between gap-2 mb-4">
      <h2 class="text-h5">
        Sessions à encaisser
      </h2>
      <span
        v-if="loadedOnce"
        class="text-body-2 text-medium-emphasis"
      >
        {{ plural(toCollect.length, 'session') }}<template v-if="withoutOrder">
          · {{ plural(withoutOrder, 'session') }} sans commande
        </template>
      </span>
    </div>

    <AppErrorState
      v-if="error && !loadedOnce"
      :error="error"
      @retry="reload"
    />

    <VRow v-else-if="!loadedOnce">
      <VCol
        v-for="n in 3"
        :key="n"
        cols="12"
        md="6"
        xl="4"
      >
        <VSkeletonLoader type="card" />
      </VCol>
    </VRow>

    <VCard v-else-if="toCollect.length === 0">
      <AppEmptyState
        icon="ri-checkbox-circle-line"
        title="Rien à encaisser"
        :text="withoutOrder
          ? `Toutes les additions sont soldées. ${plural(withoutOrder, 'session')} sans commande en attente de leur première commande.`
          : 'Toutes les additions sont soldées. Les nouvelles apparaîtront ici dès qu\'une commande sera passée.'"
      />
    </VCard>

    <VRow v-else>
      <VCol
        v-for="row in toCollect"
        :key="row.session.id"
        cols="12"
        md="6"
        xl="4"
      >
        <SessionTile
          :row="row"
          :now="now"
          @select="goTo(row.session.id)"
        />
      </VCol>
    </VRow>

    <ShiftDialogs
      v-model:open="openDialog"
      v-model:close="closeDialog"
      v-model:summary="resultDialog"
      :loading="opening || closing"
      :error="openDialog ? openMessage : closeMessage"
      :result="closedShift"
      :pending-count="toCollect.length"
      @open="openShift"
      @close="closeShift"
    />
  </div>
</template>

<style scoped>
.shift-methods {
  padding: 16px 20px;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 18px;
  background: rgb(var(--v-theme-surface));
}

.shift-methods__title {
  margin-block-end: 12px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shift-methods__list {
  display: grid;
  gap: 12px;
  padding: 0;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  list-style: none;
}

.shift-methods__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(var(--method), 0.09);
}

.shift-methods__icon {
  display: grid;
  flex: none;
  place-items: center;
  inline-size: 40px;
  block-size: 40px;
  border-radius: 12px;
  background: rgba(var(--method), 0.16);
  color: rgb(var(--method));
}

.shift-methods__label,
.shift-methods__amount,
.shift-methods__count {
  display: block;
}

.shift-methods__label,
.shift-methods__count {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8125rem;
}

.shift-methods__amount {
  font-size: 1.125rem;
  font-weight: 700;
}
</style>
