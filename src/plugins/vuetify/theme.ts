import type { ThemeDefinition } from 'vuetify'

/**
 * Identité visuelle de Marinade : un orange paprika sur des neutres chauds.
 * Le primaire passe le contraste AA avec du texte blanc (4,9:1).
 */
export const staticPrimaryColor = '#C2410C'
export const staticPrimaryDarkenColor = '#9A3412'

/** Couleurs communes aux deux thèmes : sémantique et marque. */
const brand = {
  'primary': staticPrimaryColor,
  'on-primary': '#fff',
  'primary-darken-1': staticPrimaryDarkenColor,
  'secondary': '#78716C',
  'secondary-darken-1': '#57534E',
  'on-secondary': '#fff',
  'success': '#2E9E5B',
  'success-darken-1': '#25844C',
  'on-success': '#fff',
  'info': '#0E7FB8',
  'info-darken-1': '#0B6A9C',
  'on-info': '#fff',
  'warning': '#D98A00',
  'warning-darken-1': '#B87400',
  'on-warning': '#fff',
  'error': '#D6393F',
  'error-darken-1': '#B92F35',
  'on-error': '#fff',
}

const sharedVariables = {
  'code-color': '#C2410C',
  'overlay-scrim-opacity': 0.5,
  'hover-opacity': 0.04,
  'focus-opacity': 0.1,
  'selected-opacity': 0.08,
  'activated-opacity': 0.16,
  'pressed-opacity': 0.14,
  'dragged-opacity': 0.1,
  'disabled-opacity': 0.4,
  'border-opacity': 0.12,
  'high-emphasis-opacity': 0.9,
  'medium-emphasis-opacity': 0.7,
}

export const themes: Record<string, ThemeDefinition> = {
  light: {
    dark: false,
    colors: {
      ...brand,
      'background': '#F6F4F2',
      'on-background': '#1C1917',
      'surface': '#fff',
      'on-surface': '#1C1917',
      'grey-50': '#FAFAF9',
      'grey-100': '#F5F5F4',
      'grey-200': '#E7E5E4',
      'grey-300': '#D6D3D1',
      'grey-400': '#A8A29E',
      'grey-500': '#78716C',
      'grey-600': '#57534E',
      'grey-700': '#44403C',
      'grey-800': '#292524',
      'grey-900': '#1C1917',
      'perfect-scrollbar-thumb': '#D6D3D1',
      'skin-bordered-background': '#fff',
      'skin-bordered-surface': '#fff',
      'expansion-panel-text-custom-bg': '#FAFAF9',
      'track-bg': '#F0EEEC',
      'chat-bg': '#F7F5F3',
    },
    variables: {
      ...sharedVariables,
      'overlay-scrim-background': '#1C1917',
      'tooltip-background': '#292524',
      'border-color': '#1C1917',
      'table-header-color': '#F6F4F2',

      // 👉 shadows
      'shadow-key-umbra-color': '#1C1917',
      'shadow-xs-opacity': '0.16',
      'shadow-sm-opacity': '0.18',
      'shadow-md-opacity': '0.20',
      'shadow-lg-opacity': '0.22',
      'shadow-xl-opacity': '0.24',
    },
  },

  dark: {
    dark: true,
    colors: {
      ...brand,
      'primary': '#EA6A2B',
      'primary-darken-1': '#D55A1E',
      'background': '#171412',
      'on-background': '#F5F5F4',
      'surface': '#221E1C',
      'on-surface': '#F5F5F4',
      'grey-50': '#26211F',
      'grey-100': '#2C2724',
      'grey-200': '#44403C',
      'grey-300': '#57534E',
      'grey-400': '#78716C',
      'grey-500': '#A8A29E',
      'grey-600': '#C4BFBB',
      'grey-700': '#D6D3D1',
      'grey-800': '#E7E5E4',
      'grey-900': '#F5F5F4',
      'perfect-scrollbar-thumb': '#44403C',
      'skin-bordered-background': '#221E1C',
      'skin-bordered-surface': '#221E1C',
      'expansion-panel-text-custom-bg': '#2A2522',
      'track-bg': '#3A3532',
      'chat-bg': '#2A2522',
    },
    variables: {
      ...sharedVariables,
      'overlay-scrim-background': '#221E1C',
      'tooltip-background': '#F5F5F4',
      'border-color': '#F5F5F4',
      'table-header-color': '#2C2724',

      // 👉 Shadows
      'shadow-key-umbra-color': '#0C0A09',
      'shadow-xs-opacity': '0.20',
      'shadow-sm-opacity': '0.22',
      'shadow-md-opacity': '0.24',
      'shadow-lg-opacity': '0.26',
      'shadow-xl-opacity': '0.28',
    },
  },
}

export default themes
