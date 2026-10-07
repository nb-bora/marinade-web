import { useTheme } from 'vuetify'
import { hexToRgb } from '@layouts/utils'

/**
 * Couleurs et typographie des graphiques ApexCharts, tirées du thème Vuetify courant :
 * un graphique suit seul le passage du thème clair au sombre.
 */
export function useChartTheme() {
  const theme = useTheme()

  return computed(() => {
    const { colors, variables } = theme.current.value
    const onSurface = hexToRgb(String(colors['on-surface']))
    const alpha = (value: unknown) => Number(value)

    return {
      primary: String(colors.primary),
      success: String(colors.success),
      info: String(colors.info),
      warning: String(colors.warning),
      error: String(colors.error),
      secondary: String(colors.secondary),

      /** Teinte claire du primaire (barres secondaires). */
      primarySoft: `rgba(${hexToRgb(String(colors.primary))}, 0.16)`,
      text: `rgba(${onSurface}, ${alpha(variables['medium-emphasis-opacity'])})`,
      textStrong: `rgba(${onSurface}, ${alpha(variables['high-emphasis-opacity'])})`,
      grid: `rgba(${onSurface}, ${alpha(variables['border-opacity'])})`,
      surface: String(colors.surface),
      fontFamily: 'Inter, sans-serif',
      mode: theme.current.value.dark ? 'dark' as const : 'light' as const,
    }
  })
}
