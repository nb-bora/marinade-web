<!-- Pages d'accès (connexion, inscription...) : illustration à gauche, formulaire à droite. -->
<script setup lang="ts">
import logo from '@images/logo.svg?raw'

withDefaults(defineProps<{
  title: string
  subtitle?: string

  /** Formulaire plus large (assistant d'inscription). */
  wide?: boolean
}>(), { wide: false })
</script>

<template>
  <div
    class="auth-shell"
    :class="{ 'auth-shell--wide': wide }"
  >
    <aside
      class="auth-shell__visual"
      aria-hidden="true"
    >
      <RouterLink
        to="/"
        class="auth-shell__brand"
        tabindex="-1"
      >
        <!-- eslint-disable vue/no-v-html -->
        <span
          class="d-flex"
          v-html="logo"
        />
        <!-- eslint-enable -->
        <span class="text-h5 font-weight-bold">Marinade</span>
      </RouterLink>

      <div class="auth-shell__stage">
        <ServiceIllustration class="auth-shell__illustration" />

        <div class="floating floating--top">
          <VAvatar
            color="success"
            variant="tonal"
            rounded
            size="38"
          >
            <VIcon icon="ri-money-dollar-circle-line" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis">
              Encaissé aujourd'hui
            </div>
            <div class="text-subtitle-1 font-weight-semibold">
              136 500 FCFA
              <span class="text-success text-caption">▲ 12 %</span>
            </div>
          </div>
        </div>

        <div class="floating floating--right">
          <div class="text-caption text-medium-emphasis">
            Paiements Mobile Money
          </div>
          <div class="d-flex align-end gap-1 mt-2 bars">
            <span style="block-size: 40%" />
            <span style="block-size: 70%" />
            <span style="block-size: 55%" />
            <span style="block-size: 90%" />
            <span style="block-size: 65%" />
            <span
              class="bars__peak"
              style="block-size: 100%"
            />
          </div>
        </div>

        <div class="floating floating--bottom">
          <VAvatar
            color="primary"
            variant="tonal"
            rounded
            size="38"
          >
            <VIcon icon="ri-restaurant-2-line" />
          </VAvatar>
          <div>
            <div class="text-subtitle-1 font-weight-semibold">
              48 commandes
            </div>
            <div class="text-caption text-medium-emphasis">
              dont 6 en cuisine
            </div>
          </div>
        </div>
      </div>

      <p class="auth-shell__tagline text-body-1 text-medium-emphasis">
        Salle, cuisine, caisse et paiements : tout votre restaurant au même endroit.
      </p>
    </aside>

    <main class="auth-shell__form">
      <div
        class="auth-shell__panel"
        :class="{ 'auth-shell__panel--wide': wide }"
      >
        <RouterLink
          to="/"
          class="auth-shell__brand auth-shell__brand--mobile mb-8"
        >
          <!-- eslint-disable vue/no-v-html -->
          <span
            class="d-flex"
            v-html="logo"
          />
          <!-- eslint-enable -->
          <span class="text-h5 font-weight-bold">Marinade</span>
        </RouterLink>

        <h1 class="text-h4 font-weight-semibold mb-1">
          {{ title }}
        </h1>
        <p
          v-if="subtitle"
          class="text-body-1 text-medium-emphasis mb-6"
        >
          {{ subtitle }}
        </p>

        <slot />

        <div
          v-if="$slots.footer"
          class="text-center mt-6 text-body-1"
        >
          <slot name="footer" />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.auth-shell {
  display: flex;
  min-block-size: 100dvh;
  background: rgb(var(--v-theme-surface));
}

.auth-shell__visual {
  position: relative;
  display: none;
  flex: 1 1 58%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6rem 3rem 3rem;
  background:
    radial-gradient(circle at 70% 30%, rgba(var(--v-theme-primary), 0.1), transparent 55%),
    rgb(var(--v-theme-background));
  overflow: hidden;

  @media (min-width: 960px) {
    display: flex;
  }
}

.auth-shell__brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: inherit;
  text-decoration: none;
}

.auth-shell__visual > .auth-shell__brand {
  position: absolute;
  inset-block-start: 2rem;
  inset-inline-start: 2.25rem;
}

.auth-shell__brand--mobile {
  @media (min-width: 960px) {
    display: none;
  }
}

.auth-shell__stage {
  position: relative;
  inline-size: min(100%, 30rem);
}

.auth-shell__illustration {
  display: block;
}

.auth-shell__tagline {
  max-inline-size: 26rem;
  margin-block-start: 2rem;
  text-align: center;
}

.floating {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 6px 24px -8px rgba(var(--v-shadow-key-umbra-color), 0.28);
  animation: float 6s ease-in-out infinite;
}

.floating--top {
  inset-block-start: -1rem;
  inset-inline-start: -2.5rem;
}

.floating--right {
  display: block;
  inset-block-start: 2%;
  inset-inline-end: -3rem;
  min-inline-size: 9.5rem;
  animation-delay: 1.5s;
}

.floating--bottom {
  inset-block-end: 6%;
  inset-inline-start: -1.5rem;
  animation-delay: 3s;
}

.bars {
  block-size: 3rem;

  span {
    flex: 1;
    border-radius: 4px;
    background: rgba(var(--v-theme-primary), 0.18);
  }

  .bars__peak {
    background: rgb(var(--v-theme-primary));
  }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@media (prefers-reduced-motion: reduce) {
  .floating { animation: none; }
}

.auth-shell__form {
  display: flex;
  flex: 1 1 42%;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
}

.auth-shell__panel {
  inline-size: 100%;
  max-inline-size: 26rem;
}

.auth-shell--wide {
  .auth-shell__visual {
    flex-basis: 40%;
  }

  .auth-shell__form {
    flex-basis: 60%;
  }
}

.auth-shell__panel--wide {
  max-inline-size: 40rem;
}
</style>
