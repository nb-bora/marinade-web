<script lang="ts" setup>
import VerticalNavLink from '@layouts/components/VerticalNavLink.vue'
import VerticalNavSectionTitle from '@layouts/components/VerticalNavSectionTitle.vue'
import { buildNavigation } from '@/lib/module/registry'
import { features } from '@/plugins/router'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'

const session = useSessionStore()
const tenant = useTenantStore()

// Le menu est BÂTI à partir des modules : il suit seul les droits de l'utilisateur dans le
// restaurant courant, sans qu'aucun lien ne soit écrit ici.
const sections = computed(() =>
  buildNavigation(features, {
    isPlatformAdmin: session.isPlatformAdmin,
    can: capability => tenant.can(capability),
  }),
)
</script>

<template>
  <template
    v-for="section in sections"
    :key="section.id"
  >
    <VerticalNavSectionTitle
      v-if="section.title"
      :item="{ heading: section.title }"
    />
    <VerticalNavLink
      v-for="entry in section.entries"
      :key="entry.id"
      :item="{ title: entry.title, icon: entry.icon, to: entry.to }"
    />
  </template>
</template>
