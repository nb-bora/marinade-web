<!--
  Mise en page d'un document légal : en-tête, sommaire (fixe sur grand écran, repliable sur mobile)
  avec suivi de la section lue, contenu, liens vers l'autre document, impression.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { LegalDocument } from '../content/types'
import LegalInline from './LegalInline.vue'
import logo from '@images/logo.svg?raw'

const props = defineProps<{
  document: LegalDocument
  current: 'privacy' | 'terms'
}>()

const activeId = ref<string | null>(null)
const tocOpen = ref(false)

const updatedLabel = computed(() => new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(`${props.document.updatedAt}T00:00:00Z`)))

const otherDocument = computed(() => props.current === 'privacy'
  ? { to: '/terms', label: 'Conditions d\'utilisation' }
  : { to: '/privacy', label: 'Politique de confidentialité' })

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function goTo(id: string) {
  const target = window.document.getElementById(id)

  if (!target)
    return

  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  window.history.replaceState(window.history.state, '', `#${id}`)
  activeId.value = id
  tocOpen.value = false
  target.focus({ preventScroll: true })
}

const printDocument = () => window.print()

let observer: IntersectionObserver | null = null

onMounted(() => {
  // Suit la section la plus haute visible dans la zone de lecture (le haut de l'écran).
  observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting)

    if (visible.length > 0)
      activeId.value = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0].target.id
  }, { rootMargin: '-80px 0px -65% 0px' })

  for (const section of props.document.sections) {
    const element = window.document.getElementById(section.id)

    if (element)
      observer.observe(element)
  }

  // Ouverture directe sur une ancre (`/privacy#conservation`).
  const hash = decodeURIComponent(window.location.hash.slice(1))

  if (hash)
    requestAnimationFrame(() => window.document.getElementById(hash)?.scrollIntoView({ block: 'start' }))
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="legal">
    <header class="legal__bar">
      <div class="legal__bar-inner">
        <RouterLink
          to="/"
          class="legal__brand"
          aria-label="Marinade, retour à l'accueil"
        >
          <!-- eslint-disable vue/no-v-html -->
          <span
            class="d-flex"
            v-html="logo"
          />
          <!-- eslint-enable -->
          <span class="text-h6 font-weight-bold">Marinade</span>
        </RouterLink>

        <nav
          class="legal__nav"
          aria-label="Documents légaux"
        >
          <RouterLink
            to="/privacy"
            class="legal__nav-link"
            :class="{ 'legal__nav-link--active': current === 'privacy' }"
            :aria-current="current === 'privacy' ? 'page' : undefined"
          >
            Confidentialité
          </RouterLink>
          <RouterLink
            to="/terms"
            class="legal__nav-link"
            :class="{ 'legal__nav-link--active': current === 'terms' }"
            :aria-current="current === 'terms' ? 'page' : undefined"
          >
            Conditions
          </RouterLink>
        </nav>
      </div>
    </header>

    <div class="legal__hero">
      <div class="legal__container">
        <p class="legal__eyebrow">
          Informations légales
        </p>
        <h1 class="text-h3 font-weight-bold mb-3">
          {{ document.title }}
        </h1>
        <p class="text-body-1 text-medium-emphasis legal__summary">
          {{ document.summary }}
        </p>

        <div class="d-flex flex-wrap align-center gap-3 mt-5">
          <VChip
            size="small"
            variant="tonal"
            prepend-icon="ri-calendar-line"
          >
            Mise à jour le {{ updatedLabel }}
          </VChip>
          <VChip
            size="small"
            variant="tonal"
            prepend-icon="ri-file-text-line"
          >
            Version {{ document.version }}
          </VChip>
          <VBtn
            size="small"
            variant="text"
            prepend-icon="ri-printer-line"
            class="legal__print"
            @click="printDocument"
          >
            Imprimer
          </VBtn>
        </div>
      </div>
    </div>

    <div class="legal__container legal__layout">
      <aside class="legal__toc">
        <button
          type="button"
          class="legal__toc-toggle"
          :aria-expanded="tocOpen"
          aria-controls="legal-toc-list"
          @click="tocOpen = !tocOpen"
        >
          <span>Sommaire</span>
          <VIcon :icon="tocOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" />
        </button>

        <nav
          id="legal-toc-list"
          class="legal__toc-list"
          :class="{ 'legal__toc-list--open': tocOpen }"
          aria-label="Sommaire"
        >
          <p class="legal__toc-title">
            Sommaire
          </p>
          <ol>
            <li
              v-for="(section, index) in document.sections"
              :key="section.id"
            >
              <a
                :href="`#${section.id}`"
                :class="{ 'legal__toc-link--active': activeId === section.id }"
                :aria-current="activeId === section.id ? 'location' : undefined"
                class="legal__toc-link"
                @click.prevent="goTo(section.id)"
              >
                <span class="legal__toc-number">{{ index + 1 }}</span>
                {{ section.title }}
              </a>
            </li>
          </ol>
        </nav>
      </aside>

      <main class="legal__content">
        <section
          v-for="(section, index) in document.sections"
          :id="section.id"
          :key="section.id"
          tabindex="-1"
          class="legal__section"
          :aria-labelledby="`${section.id}-title`"
        >
          <h2
            :id="`${section.id}-title`"
            class="text-h5 font-weight-semibold mb-4"
          >
            <span class="legal__section-number">{{ index + 1 }}.</span>
            {{ section.title }}
          </h2>

          <template
            v-for="(block, blockIndex) in section.blocks"
            :key="blockIndex"
          >
            <p
              v-if="block.type === 'p'"
              class="legal__p"
            >
              <LegalInline :text="block.text" />
            </p>

            <ul
              v-else-if="block.type === 'ul'"
              class="legal__list"
            >
              <li
                v-for="(item, itemIndex) in block.items"
                :key="itemIndex"
              >
                <LegalInline :text="item" />
              </li>
            </ul>

            <ol
              v-else-if="block.type === 'ol'"
              class="legal__list"
            >
              <li
                v-for="(item, itemIndex) in block.items"
                :key="itemIndex"
              >
                <LegalInline :text="item" />
              </li>
            </ol>

            <VAlert
              v-else-if="block.type === 'note'"
              type="info"
              variant="tonal"
              density="comfortable"
              class="legal__note"
            >
              <LegalInline :text="block.text" />
            </VAlert>

            <div
              v-else-if="block.type === 'table'"
              class="legal__table-wrap"
              tabindex="0"
              role="region"
              :aria-label="block.caption"
            >
              <table class="legal__table">
                <caption class="legal__caption">
                  {{ block.caption }}
                </caption>
                <thead>
                  <tr>
                    <th
                      v-for="heading in block.head"
                      :key="heading"
                      scope="col"
                    >
                      {{ heading }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, rowIndex) in block.rows"
                    :key="rowIndex"
                  >
                    <th scope="row">
                      <LegalInline :text="row[0]" />
                    </th>
                    <td
                      v-for="(cell, cellIndex) in row.slice(1)"
                      :key="cellIndex"
                    >
                      <LegalInline :text="cell" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </section>

        <footer class="legal__footer">
          <RouterLink
            :to="otherDocument.to"
            class="legal__next"
          >
            <span class="text-caption text-medium-emphasis">À lire aussi</span>
            <span class="text-subtitle-1 font-weight-semibold">
              {{ otherDocument.label }}
              <VIcon
                icon="ri-arrow-right-line"
                size="18"
              />
            </span>
          </RouterLink>

          <div class="legal__footer-actions">
            <VBtn
              variant="text"
              prepend-icon="ri-arrow-up-line"
              @click="goTo(document.sections[0].id)"
            >
              Haut de page
            </VBtn>
            <VBtn
              variant="tonal"
              to="/"
            >
              Retour à Marinade
            </VBtn>
          </div>
        </footer>
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.legal {
  min-block-size: 100dvh;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

.legal__bar {
  position: sticky;
  z-index: 10;
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgba(var(--v-theme-surface), 0.92);
  backdrop-filter: blur(8px);
  inset-block-start: 0;
}

.legal__bar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-inline: auto;
  max-inline-size: 72rem;
  padding: 0.75rem 1.5rem;
}

.legal__brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  color: inherit;
  text-decoration: none;
}

.legal__nav {
  display: flex;
  gap: 0.25rem;
}

.legal__nav-link {
  padding: 0.375rem 0.75rem;
  border-radius: 8px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.9375rem;
  text-decoration: none;

  &:hover { background: rgba(var(--v-theme-primary), 0.08); }

  &--active {
    background: rgba(var(--v-theme-primary), 0.12);
    color: rgb(var(--v-theme-primary));
    font-weight: 600;
  }
}

.legal__container {
  margin-inline: auto;
  max-inline-size: 72rem;
  padding-inline: 1.5rem;
}

.legal__hero {
  padding-block: 3rem 2.5rem;
  background:
    radial-gradient(circle at 85% 0%, rgba(var(--v-theme-primary), 0.1), transparent 55%),
    rgb(var(--v-theme-background));
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.legal__eyebrow {
  margin-block-end: 0.5rem;
  color: rgb(var(--v-theme-primary));
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.legal__summary { max-inline-size: 44rem; }

.legal__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2rem;
  padding-block: 2rem 4rem;

  @media (min-width: 960px) {
    grid-template-columns: 16rem minmax(0, 1fr);
    gap: 3.5rem;
  }
}

.legal__toc {
  @media (min-width: 960px) {
    position: sticky;
    align-self: start;
    inset-block-start: 5.5rem;
    max-block-size: calc(100dvh - 7rem);
    overflow-y: auto;
  }
}

.legal__toc-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  inline-size: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
  background: rgb(var(--v-theme-surface));
  color: inherit;
  cursor: pointer;
  font-weight: 600;

  @media (min-width: 960px) { display: none; }
}

.legal__toc-list {
  display: none;
  margin-block-start: 0.5rem;

  &--open { display: block; }

  @media (min-width: 960px) {
    display: block;
    margin-block-start: 0;
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }
}

.legal__toc-title {
  display: none;
  margin-block-end: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));

  @media (min-width: 960px) { display: block; }
}

.legal__toc-link {
  display: flex;
  gap: 0.625rem;
  padding: 0.4375rem 0.75rem;
  border-inline-start: 2px solid transparent;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.875rem;
  line-height: 1.35;
  text-decoration: none;

  &:hover { color: rgb(var(--v-theme-primary)); }

  &--active {
    border-inline-start-color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.08);
    color: rgb(var(--v-theme-primary));
    font-weight: 600;
  }
}

.legal__toc-number {
  min-inline-size: 1.25rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}

.legal__content { min-inline-size: 0; max-inline-size: 48rem; }

.legal__section {
  padding-block-end: 2.25rem;
  scroll-margin-block-start: 5.5rem;

  &:focus { outline: none; }
}

.legal__section-number {
  margin-inline-end: 0.25rem;
  color: rgb(var(--v-theme-primary));
}

.legal__p,
.legal__list {
  margin-block-end: 1rem;
  font-size: 1rem;
  line-height: 1.7;
}

.legal__list {
  padding-inline-start: 1.375rem;

  li { margin-block-end: 0.5rem; padding-inline-start: 0.25rem; }
}

.legal__note { margin-block-end: 1rem; }

:deep(.legal-link) {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
  text-underline-offset: 2px;
}

.legal__table-wrap {
  margin-block-end: 1.25rem;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
  overflow-x: auto;
}

.legal__table {
  inline-size: 100%;
  min-inline-size: 34rem;
  border-collapse: collapse;
  font-size: 0.9375rem;
  line-height: 1.55;

  th,
  td {
    padding: 0.75rem 1rem;
    border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    text-align: start;
    vertical-align: top;
  }

  thead th {
    background: rgba(var(--v-theme-primary), 0.06);
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.03em;
  }

  tbody th { font-weight: 600; }
  tbody tr:last-child > * { border-block-end: 0; }
}

// Légende lue par les lecteurs d'écran ; le titre de la région la porte déjà visuellement.
.legal__caption {
  position: absolute;
  overflow: hidden;
  block-size: 1px;
  inline-size: 1px;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.legal__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-block-start: 1rem;
  padding-block-start: 2rem;
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.legal__next {
  display: flex;
  flex-direction: column;
  padding: 0.75rem 1.25rem;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
  color: inherit;
  text-decoration: none;

  &:hover { border-color: rgb(var(--v-theme-primary)); }
}

.legal__footer-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }

@media print {
  .legal__bar,
  .legal__toc,
  .legal__print,
  .legal__footer-actions,
  .legal__next { display: none !important; }

  .legal__hero { background: none; padding-block: 0 1rem; }
  .legal__layout { display: block; padding-block: 1rem; }
  .legal__section { break-inside: avoid-page; }
  .legal__table-wrap { overflow: visible; }
  :deep(.legal-link) { color: inherit; text-decoration: none; }
}
</style>
