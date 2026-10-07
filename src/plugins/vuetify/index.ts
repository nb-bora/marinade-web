import type { App } from 'vue'

import { createVuetify } from 'vuetify'
import { en, fr } from 'vuetify/locale'
import { VBtn } from 'vuetify/components/VBtn'
import defaults from './defaults'
import { icons } from './icons'
import { themes } from './theme'

// Styles

import '@core/scss/template/libs/vuetify/index.scss'
import 'vuetify/styles'

const THEME_KEY = 'marinade.theme'

/** Thème retenu par l'utilisateur, sinon celui de son système. */
function initialTheme(): 'light' | 'dark' {
  try {
    const stored = window.localStorage.getItem(THEME_KEY)

    if (stored === 'light' || stored === 'dark')
      return stored
  }
  catch {
    // Stockage indisponible : on suit le système.
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function (app: App) {
  const vuetify = createVuetify({
    aliases: {
      IconBtn: VBtn,
    },
    defaults,
    icons,

    // Libellés internes (« Effacer », « Page suivante »...) et lecteurs d'écran en français.
    locale: { locale: 'fr', fallback: 'en', messages: { fr, en } },
    theme: {
      defaultTheme: initialTheme(),
      themes,
    },
  })

  app.use(vuetify)

  watch(vuetify.theme.global.name, name => {
    try {
      window.localStorage.setItem(THEME_KEY, name)
    }
    catch {
      // Le choix ne sera pas retenu ; l'interface reste utilisable.
    }
  })
}
