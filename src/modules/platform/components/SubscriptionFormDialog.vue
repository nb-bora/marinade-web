<!-- Abonnement d'un restaurant à une offre. -->
<script setup lang="ts">
import { platformApi } from '../api'
import { SUBSCRIPTION_STATUS_OPTIONS } from '../labels'
import type { Subscription, SubscriptionStatus, Tier } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useSubmit } from '@/composables/useSubmit'
import { formatMoney } from '@/lib/format'
import type { RestaurantAccess } from '@/lib/api/types'
import { useToast } from '@/stores/toast.store'

defineProps<{ tiers: Tier[] }>()

const emit = defineEmits<{ saved: [subscription: Subscription] }>()
const open = defineModel<boolean>({ required: true })

const toast = useToast()

const restaurantId = ref<string | null>(null)
const tierId = ref<number | null>(null)
const status = ref<SubscriptionStatus>('active')
const startDate = ref('')
const endDate = ref('')

// Recherche des restaurants au fil de la frappe.
const query = ref('')
const queryDebounced = refDebounced(query, 250)

const restaurantTitle = (item: RestaurantAccess) => item.city ? `${item.name} (${item.city})` : item.name

const restaurantItems = ref<RestaurantAccess[]>([])
const selected = computed(() => restaurantItems.value.find(item => item.restaurant_id === restaurantId.value) ?? null)

// Une fois un restaurant choisi, le champ affiche son nom : ce n'est pas une nouvelle recherche.
const { loading: searching } = useAsyncData(async signal => {
  const text = queryDebounced.value

  if (selected.value && text === restaurantTitle(selected.value))
    return null

  const list = await platformApi.restaurants(text, signal)
  const keep = selected.value

  restaurantItems.value = keep && !list.some(item => item.restaurant_id === keep.restaurant_id) ? [keep, ...list] : list

  return null
}, { watch: [queryDebounced], immediate: false })

const { submit, pending, message, apiError, reset } = useSubmit(async () => {
  if (!restaurantId.value || tierId.value === null)
    return

  // Le serveur exige le propriétaire du restaurant : on le lit sur sa fiche.
  const restaurant = await platformApi.restaurant(restaurantId.value)

  const subscription = await platformApi.createSubscription({
    restaurant_id: restaurant.id,
    user_id: restaurant.user_id,
    tier_id: tierId.value,
    status: status.value,
    start_date: startDate.value,
    end_date: endDate.value || null,
  })

  toast.success('Abonnement créé.')
  open.value = false
  emit('saved', subscription)
})

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()
  restaurantId.value = null
  tierId.value = null
  status.value = 'active'
  startDate.value = new Date().toISOString().slice(0, 10)
  endDate.value = ''
  query.value = ''
  platformApi.restaurants('').then(list => {
    restaurantItems.value = list
  }).catch(() => {})
})

const restaurantRules = [(value: string | null) => !!value || 'Choisissez un restaurant.']
const tierRules = [(value: number | null) => value !== null || 'Choisissez une offre.']
const startRules = [(value: string) => !!value || 'Indiquez la date de début.']
const endRules = [(value: string) => !value || !startDate.value || value >= startDate.value || 'La fin doit suivre le début.']

// Le serveur refuse (400) un second abonnement actif pour le même propriétaire et le même restaurant.
const errorText = computed(() => apiError.value?.status === 400
  ? 'L\'abonnement n\'a pas pu être créé : ce restaurant a peut-être déjà un abonnement actif. Choisissez un autre statut initial ou modifiez l\'abonnement existant.'
  : message.value)
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Nouvel abonnement"
    subtitle="Le restaurant est abonné au nom de son propriétaire."
    icon="ri-vip-crown-line"
    :loading="pending"
    :error="errorText"
    @submit="submit"
  >
    <VRow>
      <VCol cols="12">
        <VAutocomplete
          v-model="restaurantId"
          v-model:search="query"
          :items="restaurantItems"
          :item-title="restaurantTitle"
          item-value="restaurant_id"
          :loading="searching"
          label="Restaurant"
          prepend-inner-icon="ri-store-2-line"
          placeholder="Rechercher par nom"
          no-data-text="Aucun restaurant trouvé."
          no-filter
          :rules="restaurantRules"
          :error-messages="apiError?.fieldMessage('restaurant_id')"
        />
      </VCol>
      <VCol cols="12">
        <VSelect
          v-model="tierId"
          :items="tiers.filter(tier => tier.is_active)"
          item-title="name"
          item-value="id"
          label="Offre"
          prepend-inner-icon="ri-vip-crown-line"
          :rules="tierRules"
          :error-messages="apiError?.fieldMessage('tier_id')"
        >
          <template #item="{ props: itemProps, item }">
            <VListItem
              v-bind="itemProps"
              :subtitle="`${formatMoney(item.raw.monthly_price_fcfa)} par mois, plafond ${formatMoney(item.raw.daily_limit_fcfa)} par jour`"
            />
          </template>
        </VSelect>
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="startDate"
          type="date"
          label="Début"
          prepend-inner-icon="ri-calendar-line"
          :rules="startRules"
          :error-messages="apiError?.fieldMessage('start_date')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="endDate"
          type="date"
          label="Fin (facultative)"
          prepend-inner-icon="ri-calendar-line"
          :rules="endRules"
          :error-messages="apiError?.fieldMessage('end_date')"
        />
      </VCol>
      <VCol cols="12">
        <VSelect
          v-model="status"
          :items="SUBSCRIPTION_STATUS_OPTIONS"
          label="Statut initial"
          prepend-inner-icon="ri-list-check"
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
