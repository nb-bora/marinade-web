import type { TableState } from './labels'
import { tableStatusOf } from './labels'
import type { ServiceSession, Table, TableUpdate, TableView } from './types'

/**
 * Le back ne tient pas le compte des couverts ni le lien table → session, et il ne passe
 * pas la table en « occupée » à l'ouverture d'une session. L'interface s'en charge, avec
 * les seuls champs libres que le back offre :
 *  - `table_context` de la session : « 4 couverts · Terrasse » ;
 *  - `attributs_jsonb.service` de la table : la session en cours et les couverts.
 * Ainsi un second poste (tablette, caisse) retrouve la même information.
 */
interface TableService {
  session_id?: string
  covers?: number
}

const COVERS = /(\d+)\s*couverts?/i

export function serviceOf(table: Table): TableService {
  const raw = table.attributs_jsonb?.service

  return raw && typeof raw === 'object' ? raw as TableService : {}
}

export const contextFor = (covers: number, location?: string | null) =>
  [`${covers} couvert${covers > 1 ? 's' : ''}`, location?.trim()].filter(Boolean).join(' · ')

export function coversOf(session: ServiceSession | null, table?: Table | null): number | null {
  const match = session?.table_context ? COVERS.exec(session.table_context) : null

  if (match)
    return Number(match[1])

  const stored = table ? serviceOf(table).covers : undefined

  return typeof stored === 'number' ? stored : null
}

/** Marque la table occupée par cette session (et conserve ses autres attributs). */
export function occupy(table: Table, sessionId: string, covers: number): TableUpdate {
  return {
    statut: 'occupee',
    attributs_jsonb: { ...table.attributs_jsonb, service: { session_id: sessionId, covers } },
  }
}

/** Libère la table et efface la trace de la session. */
export function release(table: Table): TableUpdate {
  const rest = { ...table.attributs_jsonb }

  delete rest.service

  return { statut: 'libre', attributs_jsonb: rest }
}

/** Une table « occupée » dont la session n'est plus dans la liste active est soldée : à libérer. */
export function tableState(view: TableView): TableState {
  if (view.session)
    return 'occupee'

  const status = tableStatusOf(view.table.statut)

  return status === 'occupee' ? 'settled' : status
}

/** Le plan de salle d'un serveur : tri naturel des numéros (T2 avant T10). */
export const byNumber = (a: Table, b: Table) =>
  a.numero.localeCompare(b.numero, 'fr', { numeric: true, sensitivity: 'base' })

export const LOCATION_FALLBACK = 'Salle'

/** « terrasse » et « Terrasse » désignent la même zone : on met la première lettre en capitale. */
export function locationOf(table: Table): string {
  const name = table.emplacement?.trim()

  return name ? name.charAt(0).toUpperCase() + name.slice(1) : LOCATION_FALLBACK
}
