<!--
  Tableau de bord du pressing (accueil) : commandes à traiter, machines au travail avec leur
  avancement, alertes, prochaines libérations et activité. Tout vient de GET /tableau-de-bord (et de
  la liste des machines pour les machines libres et à décharger) ; l'écran se met à jour seul toutes
  les 15 secondes tant que l'onglet est visible.
-->
<script setup lang="ts">
import { pressingApi } from '../api'
import { ALERTE_NIVEAU, ALERTE_TYPE, LIVE_INTERVAL_MS, formatDuration, formatHeure, formatJour, formatKgValue } from '../commandes'
import MachineLiveTile from '../components/MachineLiveTile.vue'
import type { MetricItem } from '../components/MetricStrip.vue'
import MetricStrip from '../components/MetricStrip.vue'
import { useSyncStatus } from '../composables/useSyncStatus'
import { toTarget, unloadLabel, useMachineCycle } from '../composables/useMachineCycle'
import { CATEGORY_INFO, formatCapacity, formatMinutes, plural } from '../labels'
import type { Alerte, Machine } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useLive } from '@/composables/useLive'
import { formatMoney } from '@/lib/format'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'

const tenant = useTenantStore()
const session = useSessionStore()

const canRead = computed(() => tenant.can('front_of_house'))

const { lastSync, failed: syncFailed, track } = useSyncStatus()

const board = useAsyncData(
  signal => tenant.currentId && canRead.value ? track(pressingApi.tableauDeBord(tenant.currentId, signal), signal) : Promise.resolve(null),
  { watch: [() => tenant.currentId] },
)

const machinesData = useAsyncData(
  signal => tenant.currentId && canRead.value ? track(pressingApi.machines(tenant.currentId, { actif: true }, signal), signal) : Promise.resolve([] as Machine[]),
  { watch: [() => tenant.currentId] },
)

// Horloge commune : les barres de progression avancent sans nouvelle requête. Recalculée à chaque rafraîchissement (date du jour comprise).
const now = ref(Date.now())

const refreshAll = () => {
  now.value = Date.now()

  return Promise.all([board.refresh(), machinesData.refresh()])
}

useLive(refreshAll, LIVE_INTERVAL_MS)

useIntervalFn(() => {
  now.value = Date.now()
}, 20_000)

const { busy, finish, unload } = useMachineCycle(refreshAll)

const data = computed(() => board.data.value)
const loaded = computed(() => data.value !== null)
const machines = computed(() => machinesData.data.value ?? [])

/** Machine par identifiant : une occupation ne porte que son numéro de commande, la machine donne l'identifiant. */
const machineOf = (id: string) => machines.value.find(machine => machine.id === id) ?? null

const byName = (a: { nom: string }, b: { nom: string }) => a.nom.localeCompare(b.nom, 'fr', { numeric: true })

const toUnload = computed(() => machines.value
  .filter(machine => ['cycle_termine', 'attente_dechargement'].includes(machine.etat_operationnel))
  .sort(byName))

const free = computed(() => machines.value.filter(machine => machine.etat_operationnel === 'libre').sort(byName))

/** Machines réservées dont le cycle n'a pas encore démarré : elles doivent se voir, pas être oubliées. */
const reservees = computed(() => machines.value
  .filter(machine => machine.etat_operationnel === 'reservee' && machine.commande_courante_id)
  .sort(byName))

const occupations = computed(() => [...(data.value?.occupations ?? [])].sort((a, b) => (a.fin_estimee ?? '9').localeCompare(b.fin_estimee ?? '9')))

const alerts = computed(() => [...(data.value?.alertes ?? [])].sort((a, b) => ALERTE_NIVEAU[a.niveau].rank - ALERTE_NIVEAU[b.niveau].rank))

const strip = computed<MetricItem[]>(() => {
  const commandes = data.value?.commandes
  const finance = data.value?.finance

  return [
    { label: 'À prendre en charge', value: String(commandes?.en_attente_prise_en_charge ?? 0), icon: 'ri-inbox-archive-line', color: 'warning', hint: 'Commandes reçues, sans machine', to: '/pressing/commandes?onglet=a_prendre' },
    { label: 'En cours', value: String(commandes?.en_cours ?? 0), icon: 'ri-refresh-line', color: 'primary', hint: 'Commandes en machine ou en attente', to: '/pressing/commandes?onglet=en_cours' },
    { label: 'Terminées aujourd\'hui', value: String(commandes?.terminees_jour ?? 0), icon: 'ri-checkbox-circle-line', color: 'success', hint: 'Commandes prêtes depuis ce matin', to: '/pressing/commandes?onglet=pretes' },
    { label: 'Encaissé du jour', value: formatMoney(finance?.encaisse_jour), icon: 'ri-hand-coin-line', color: 'success', hint: 'Paiements reçus aujourd\'hui', to: '/pressing/caisse' },
    { label: 'Reste à payer', value: formatMoney(finance?.reste_a_payer_total), icon: 'ri-wallet-3-line', color: (finance?.reste_a_payer_total ?? 0) > 0 ? 'warning' : 'secondary', hint: 'Sur l\'ensemble des commandes non annulées', to: '/pressing/commandes?onglet=toutes' },
  ]
})

function alertLink(alert: Alerte): string | undefined {
  if (alert.commande_id)
    return `/pressing/commandes/${alert.commande_id}`

  return alert.machine_id ? `/pressing/machines?machine=${alert.machine_id}` : undefined
}

const upcoming = computed(() => data.value?.prochaines_liberations.slice(0, 5) ?? [])

const minutesUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - now.value) / 60000))

const usage = computed(() => data.value?.utilisation)

/** Date du jour dans le fuseau du pressing, recalculée à chaque rafraîchissement. */
const today = computed(() => formatJour(new Date(now.value)))
</script>

<template>
  <div>
    <AppPageHeader
      :title="`Bonjour ${session.user?.first_name ?? ''}`"
      :subtitle="`${tenant.current?.name ?? 'Votre pressing'} · ${today}`"
    >
      <template #actions>
        <span
          v-if="data"
          class="text-body-2 text-medium-emphasis"
          data-testid="pressing-updated"
        >
          Mis à jour à {{ formatHeure(data.genere_a) }}
        </span>
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-layout-grid-line"
          to="/pressing/plan"
          data-tour="dashboard-plan"
        >
          Voir le plan
        </VBtn>
        <VBtn
          v-if="canRead"
          prepend-icon="ri-add-line"
          to="/pressing/commandes/nouvelle"
          data-tour="dashboard-new"
        >
          Nouvelle commande
        </VBtn>
      </template>
    </AppPageHeader>

    <VCard v-if="!canRead">
      <AppEmptyState
        icon="ri-lock-line"
        title="Le suivi du pressing n'est pas disponible pour votre rôle"
        text="Les tarifs, les articles et le calculateur restent accessibles depuis le menu."
      />
    </VCard>

    <AppErrorState
      v-else-if="board.error.value && !loaded"
      :error="board.error.value"
      @retry="refreshAll"
    />

    <template v-else>
      <VAlert
        v-if="syncFailed && loaded"
        type="warning"
        variant="tonal"
        icon="ri-wifi-off-line"
        class="mb-4"
        data-testid="dashboard-sync-failed"
      >
        Mise à jour impossible. Les chiffres datent de {{ lastSync ? formatHeure(lastSync) : "l'ouverture de la page" }}.
      </VAlert>

      <MetricStrip
        :items="strip"
        :loading="!loaded"
        data-tour="dashboard-strip"
      />

      <VRow class="mt-2">
        <VCol
          cols="12"
          lg="7"
        >
          <VCard
            class="h-100"
            data-tour="dashboard-machines"
          >
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="primary"
                  variant="tonal"
                  rounded
                >
                  <VIcon icon="ri-t-shirt-air-line" />
                </VAvatar>
              </template>
              <VCardTitle>Machines en ce moment</VCardTitle>
              <VCardSubtitle v-if="data">
                {{ plural(data.machines.total_lave_linge, 'lave-linge', 'lave-linge') }} et {{ plural(data.machines.total_seche_linge, 'sèche-linge', 'sèche-linge') }} au total
              </VCardSubtitle>
            </VCardItem>

            <VSkeletonLoader
              v-if="!loaded"
              type="article, article"
            />

            <VCardText v-else>
              <AppEmptyState
                v-if="!occupations.length && !toUnload.length && !free.length && !reservees.length"
                icon="ri-t-shirt-air-line"
                title="Aucune machine disponible"
                text="Aucune machine n'est libre ni au travail pour l'instant : elles sont réservées, en maintenance ou hors service."
              >
                <VBtn
                  variant="outlined"
                  to="/pressing/machines"
                >
                  Voir les machines
                </VBtn>
              </AppEmptyState>

              <template v-else>
                <div
                  v-if="reservees.length"
                  class="a-demarrer mb-5 pa-4"
                  data-testid="dashboard-a-demarrer"
                >
                  <div class="d-flex align-center gap-2 mb-1">
                    <VIcon
                      icon="ri-play-circle-line"
                      color="primary"
                    />
                    <span class="text-subtitle-1 font-weight-medium">À démarrer</span>
                    <VChip
                      size="x-small"
                      color="primary"
                      variant="tonal"
                      label
                    >
                      {{ reservees.length }}
                    </VChip>
                  </div>
                  <p class="text-body-2 text-medium-emphasis mb-3">
                    Machines réservées dont le cycle n'a pas encore été lancé.
                  </p>
                  <div class="d-flex flex-column gap-2">
                    <div
                      v-for="machine in reservees"
                      :key="machine.id"
                      class="d-flex flex-wrap align-center gap-3"
                    >
                      <span class="font-weight-medium flex-grow-1">{{ machine.nom }}</span>
                      <VBtn
                        size="large"
                        class="action-btn"
                        color="primary"
                        prepend-icon="ri-arrow-right-line"
                        :to="`/pressing/commandes/${machine.commande_courante_id}`"
                        :data-testid="`start-${machine.id}`"
                      >
                        Ouvrir la commande pour démarrer
                      </VBtn>
                    </div>
                  </div>
                </div>

                <div
                  v-if="occupations.length || toUnload.length"
                  class="tiles"
                >
                  <MachineLiveTile
                    v-for="occupation in occupations"
                    :key="occupation.machine_id"
                    :nom="occupation.nom"
                    :categorie="occupation.categorie"
                    etat="en_cycle"
                    :commande-numero="occupation.commande_numero"
                    :commande-id="machineOf(occupation.machine_id)?.commande_courante_id"
                    :debut-reel="occupation.debut_reel"
                    :fin-estimee="occupation.fin_estimee"
                    :now="now"
                  >
                    <VBtn
                      size="small"
                      variant="tonal"
                      prepend-icon="ri-check-double-line"
                      class="action-btn"
                      :loading="busy.has(occupation.machine_id)"
                      @click="finish({ id: occupation.machine_id, nom: occupation.nom, etat: 'en_cycle' })"
                    >
                      Terminer le cycle
                    </VBtn>
                  </MachineLiveTile>

                  <MachineLiveTile
                    v-for="machine in toUnload"
                    :key="machine.id"
                    :nom="machine.nom"
                    :categorie="machine.categorie"
                    :etat="machine.etat_operationnel"
                    :commande-id="machine.commande_courante_id"
                    :now="now"
                  >
                    <VBtn
                      size="small"
                      variant="tonal"
                      color="warning"
                      prepend-icon="ri-inbox-unarchive-line"
                      class="action-btn"
                      :loading="busy.has(machine.id)"
                      @click="unload(toTarget(machine))"
                    >
                      {{ unloadLabel(machine.etat_operationnel) }}
                    </VBtn>
                  </MachineLiveTile>
                </div>
                <p
                  v-else
                  class="text-body-2 text-medium-emphasis mb-0"
                >
                  Aucun cycle en cours. Quand une machine démarre, elle apparaît ici avec son avancement.
                </p>

                <div
                  v-if="free.length"
                  class="free mt-5 pa-4"
                >
                  <div class="d-flex align-center gap-2 mb-3">
                    <VIcon
                      icon="ri-checkbox-circle-line"
                      color="success"
                    />
                    <span class="text-subtitle-1 font-weight-medium">Prêtes pour une commande</span>
                    <VChip
                      size="x-small"
                      color="success"
                      variant="tonal"
                      label
                    >
                      {{ free.length }}
                    </VChip>
                  </div>
                  <div class="d-flex flex-wrap gap-2">
                    <VChip
                      v-for="machine in free"
                      :key="machine.id"
                      :prepend-icon="CATEGORY_INFO[machine.categorie].icon"
                      variant="outlined"
                      :to="`/pressing/machines?machine=${machine.id}`"
                    >
                      {{ machine.nom }} · {{ formatCapacity(machine.capacite_kg) }}
                    </VChip>
                  </div>
                </div>
              </template>
            </VCardText>
          </VCard>
        </VCol>

        <VCol
          cols="12"
          lg="5"
        >
          <VCard
            class="h-100"
            data-tour="dashboard-alerts"
          >
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="warning"
                  variant="tonal"
                  rounded
                >
                  <VIcon icon="ri-notification-3-line" />
                </VAvatar>
              </template>
              <VCardTitle>Alertes</VCardTitle>
              <VCardSubtitle>Ce qui demande votre attention, le plus grave en premier.</VCardSubtitle>
            </VCardItem>

            <VSkeletonLoader
              v-if="!loaded"
              type="list-item-two-line, list-item-two-line"
            />

            <AppEmptyState
              v-else-if="!alerts.length"
              icon="ri-shield-check-line"
              title="Rien à signaler"
              text="Aucun retard, aucune panne et aucune machine à décharger en ce moment."
            />

            <VList
              v-else
              lines="two"
              class="py-0"
            >
              <template
                v-for="(alert, index) in alerts"
                :key="`${alert.type}-${alert.machine_id ?? alert.commande_id}-${index}`"
              >
                <VDivider v-if="index > 0" />
                <VListItem
                  :to="alertLink(alert)"
                  :title="alert.message"
                  :subtitle="`${ALERTE_NIVEAU[alert.niveau].label} · ${ALERTE_TYPE[alert.type]}`"
                >
                  <template #title>
                    <span class="text-wrap">{{ alert.message }}</span>
                  </template>
                  <template #prepend>
                    <VAvatar
                      :color="ALERTE_NIVEAU[alert.niveau].color"
                      variant="tonal"
                      size="36"
                    >
                      <VIcon
                        :icon="ALERTE_NIVEAU[alert.niveau].icon"
                        size="20"
                      />
                    </VAvatar>
                  </template>
                  <template
                    v-if="alertLink(alert)"
                    #append
                  >
                    <VIcon
                      icon="ri-arrow-right-s-line"
                      size="20"
                    />
                  </template>
                </VListItem>
              </template>
            </VList>
          </VCard>
        </VCol>

        <VCol
          cols="12"
          lg="7"
        >
          <VCard
            class="h-100"
            data-tour="dashboard-activity"
          >
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="info"
                  variant="tonal"
                  rounded
                >
                  <VIcon icon="ri-bar-chart-box-line" />
                </VAvatar>
              </template>
              <VCardTitle>Activité</VCardTitle>
              <VCardSubtitle>Le linge traité et le temps que prennent les cycles.</VCardSubtitle>
            </VCardItem>

            <VSkeletonLoader
              v-if="!loaded"
              type="article"
            />

            <VCardText v-else-if="data">
              <div class="facts">
                <div class="fact">
                  <div class="fact__label">
                    Poids traité aujourd'hui
                  </div>
                  <div class="fact__value">
                    {{ formatKgValue(data.activite.poids_traite_kg_jour) }}
                  </div>
                </div>
                <div class="fact">
                  <div class="fact__label">
                    Poids traité cette semaine
                  </div>
                  <div class="fact__value">
                    {{ formatKgValue(data.activite.poids_traite_kg_semaine) }}
                  </div>
                </div>
                <div class="fact">
                  <div class="fact__label">
                    Commandes du jour
                  </div>
                  <div class="fact__value">
                    {{ data.activite.nb_commandes_jour }}
                  </div>
                </div>
              </div>

              <div class="durations mt-4">
                <div class="duration duration--measured">
                  <VIcon
                    icon="ri-timer-line"
                    size="22"
                  />
                  <div>
                    <div class="fact__label">
                      Durée moyenne mesurée
                    </div>
                    <div class="text-h6 tabular-nums">
                      {{ formatDuration(data.activite.duree_moyenne_traitement_min_mesuree) }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      Relevée sur les cycles terminés.
                    </div>
                  </div>
                </div>
                <div class="duration duration--estimated">
                  <VIcon
                    icon="ri-time-line"
                    size="22"
                  />
                  <div>
                    <div class="fact__label">
                      Durée moyenne estimée
                    </div>
                    <div class="text-h6 tabular-nums">
                      {{ formatDuration(data.activite.duree_estimee_moyenne_min) }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      Prévue par les programmes des machines.
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="usage"
                class="mt-5"
              >
                <div class="d-flex flex-wrap justify-space-between align-baseline gap-2 mb-2">
                  <span class="text-subtitle-1 font-weight-medium">Taux d'utilisation du jour</span>
                  <span class="text-h6 text-primary tabular-nums">{{ usage.taux_pct_aujourdhui.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }} %</span>
                </div>
                <VProgressLinear
                  :model-value="Math.min(100, usage.taux_pct_aujourdhui)"
                  color="primary"
                  height="10"
                  rounded
                  bg-opacity="0.16"
                  aria-label="Taux d'utilisation des machines aujourd'hui"
                />
                <div class="text-body-2 text-medium-emphasis mt-2">
                  {{ formatDuration(usage.minutes_occupees) }} d'occupation sur {{ formatDuration(usage.minutes_disponibles) }} disponibles.
                </div>
              </div>

              <VDivider class="my-5" />

              <div class="text-subtitle-1 font-weight-medium mb-3">
                Chiffre d'affaires facturé
              </div>
              <div class="facts">
                <div class="fact">
                  <div class="fact__label">
                    Chiffre d'affaires du jour (facturé)
                  </div>
                  <div class="fact__value">
                    <AppMoney :amount="data.finance.ca_jour" />
                  </div>
                </div>
                <div class="fact">
                  <div class="fact__label">
                    Facturé cette semaine
                  </div>
                  <div class="fact__value">
                    <AppMoney :amount="data.finance.ca_semaine" />
                  </div>
                </div>
                <div class="fact">
                  <div class="fact__label">
                    Facturé ce mois
                  </div>
                  <div class="fact__value">
                    <AppMoney :amount="data.finance.ca_mois" />
                  </div>
                </div>
              </div>
              <p class="text-caption text-medium-emphasis mt-3 mb-0">
                Le facturé compte les commandes non annulées ; l'encaissé du jour (en haut) ne compte que les paiements reçus.
              </p>
            </VCardText>
          </VCard>
        </VCol>

        <VCol
          cols="12"
          lg="5"
        >
          <VCard
            class="h-100"
            data-tour="dashboard-releases"
          >
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="success"
                  variant="tonal"
                  rounded
                >
                  <VIcon icon="ri-calendar-schedule-line" />
                </VAvatar>
              </template>
              <VCardTitle>Prochaines libérations</VCardTitle>
              <VCardSubtitle>Les cinq prochaines fins de cycle estimées.</VCardSubtitle>
            </VCardItem>

            <VSkeletonLoader
              v-if="!loaded"
              type="list-item-two-line, list-item-two-line"
            />

            <AppEmptyState
              v-else-if="!upcoming.length"
              icon="ri-time-line"
              title="Aucune fin de cycle prévue"
              text="Dès qu'un cycle démarre, son heure de fin estimée apparaît ici."
            />

            <VCardText v-else>
              <VTimeline
                density="compact"
                side="end"
                align="start"
                line-thickness="2"
                truncate-line="both"
              >
                <VTimelineItem
                  v-for="release in upcoming"
                  :key="release.machine_id"
                  dot-color="success"
                  size="x-small"
                >
                  <div class="d-flex justify-space-between align-center gap-3">
                    <div class="min-w-0">
                      <div class="text-body-1 font-weight-medium">
                        {{ release.nom }}
                      </div>
                      <div class="text-body-2 text-medium-emphasis">
                        {{ minutesUntil(release.fin_estimee) === 0 ? 'Terminé ou sur le point de l\'être' : `Dans ${formatMinutes(minutesUntil(release.fin_estimee))}` }}
                      </div>
                    </div>
                    <span class="text-h6 tabular-nums">{{ formatHeure(release.fin_estimee) }}</span>
                  </div>
                </VTimelineItem>
              </VTimeline>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </template>
  </div>
</template>

<style scoped>
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
  gap: 12px;
}

.action-btn {
  min-block-size: 48px;
}

.a-demarrer {
  border: 1px solid rgba(var(--v-theme-primary), 0.4);
  border-radius: 14px;
  background: rgba(var(--v-theme-primary), 0.05);
}

.free {
  border: 1px dashed rgba(var(--v-theme-success), 0.5);
  border-radius: 14px;
  background: rgba(var(--v-theme-success), 0.05);
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 16px;
}

.fact__label {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.875rem;
}

.fact__value {
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  line-height: 2rem;
}

.durations {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 12px;
}

.duration {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
}

.duration--measured {
  background: rgba(var(--v-theme-success), 0.1);
}

.duration--estimated {
  background: rgba(var(--v-theme-info), 0.1);
}
</style>
