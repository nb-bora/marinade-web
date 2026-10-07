<script lang="ts" setup>
import { accountRoleLabel, relationLabel } from '@/lib/labels'
import { PATHS } from '@/lib/router/paths'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'

const session = useSessionStore()
const tenant = useTenantStore()
const router = useRouter()

const roleHere = computed(() =>
  tenant.current ? relationLabel(tenant.current) : accountRoleLabel(session.user?.role ?? ''),
)

async function logout() {
  await session.logout()
  await router.replace(PATHS.login)
}
</script>

<template>
  <VAvatar
    v-if="session.user"
    class="cursor-pointer"
    color="primary"
    variant="tonal"
    role="button"
    tabindex="0"
    aria-label="Menu du compte"
  >
    <span class="font-weight-semibold">{{ session.initials }}</span>

    <VMenu
      activator="parent"
      width="260"
      location="bottom end"
      offset="14px"
    >
      <VList>
        <VListItem>
          <VListItemTitle class="font-weight-semibold">
            {{ session.displayName }}
          </VListItemTitle>
          <VListItemSubtitle>{{ roleHere }}</VListItemSubtitle>
          <VListItemSubtitle class="text-truncate">
            {{ session.user.email }}
          </VListItemSubtitle>
        </VListItem>

        <VDivider class="my-2" />

        <VListItem
          to="/account"
          prepend-icon="ri-user-settings-line"
          title="Mon compte"
        />
        <VListItem
          prepend-icon="ri-logout-box-r-line"
          title="Se déconnecter"
          @click="logout"
        />
      </VList>
    </VMenu>
  </VAvatar>
</template>
