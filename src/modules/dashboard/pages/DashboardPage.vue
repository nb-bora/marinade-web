<script setup lang="ts">
import type { Component } from 'vue'
import { defineAsyncComponent } from 'vue'
import { collectWidgets } from '@/lib/module/registry'
import type { DashboardWidget } from '@/lib/module/types'
import { features } from '@/plugins/router'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'

const session = useSessionStore()
const tenant = useTenantStore()

const widgets = computed(() => collectWidgets(features, { can: capability => tenant.can(capability), etablissement: tenant.typeEtablissement }))

// Un composant asynchrone par widget, créé une seule fois : sinon chaque recalcul de la
// liste remonterait les widgets et leur ferait refaire leurs requêtes.
const components = new Map<string, Component>()

function componentOf(widget: DashboardWidget): Component {
  let component = components.get(widget.id)

  if (!component) {
    component = defineAsyncComponent(widget.component)
    components.set(widget.id, component)
  }

  return component
}

const today = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
</script>

<template>
  <div>
    <VRow v-if="widgets.length">
      <VCol
        v-for="widget in widgets"
        :key="widget.id"
        cols="12"
        :md="widget.width"
      >
        <component :is="componentOf(widget)" />
      </VCol>
    </VRow>

    <template v-else>
      <AppPageHeader
        :title="`Bonjour ${session.user?.first_name ?? ''} 👋`"
        :subtitle="`${tenant.current?.name ?? ''} · ${today}`"
      />
      <VCard>
        <AppEmptyState
          icon="ri-restaurant-line"
          title="Bienvenue"
          text="Utilisez le menu pour accéder aux écrans de votre rôle."
        />
      </VCard>
    </template>
  </div>
</template>
