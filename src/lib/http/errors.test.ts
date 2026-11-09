import { describe, expect, it } from 'vitest'
import { describeError } from './errorMessages'
import { ApiError, apiErrorFromResponse, isApiError, kindOf } from './errors'

describe('apiErrorFromResponse', () => {
  it('lit une HTTPException de FastAPI', () => {
    const error = apiErrorFromResponse(404, { detail: 'Restaurant not found' })

    expect(error.status).toBe(404)
    expect(error.kind).toBe('not_found')
    expect(error.message).toBe('Restaurant not found')
  })

  it('lit la validation Pydantic et en tire les erreurs par champ', () => {
    const error = apiErrorFromResponse(422, {
      detail: [
        { loc: ['body', 'email'], msg: 'Invalid email format', type: 'value_error' },
        { loc: ['body', 'items', 0, 'quantity'], msg: 'Input should be greater than 0', type: 'greater_than' },
      ],
    })

    expect(error.kind).toBe('validation')
    expect(error.fieldMessage('email')).toBe('Invalid email format')
    expect(error.fieldMessage('items.0.quantity')).toBe('Input should be greater than 0')
    expect(error.fieldErrors).toHaveLength(2)
  })

  it('lit une exception métier de Marinade et conserve ses détails', () => {
    const error = apiErrorFromResponse(401, {
      error: 'AuthenticationError',
      message: 'Two-factor authentication code required',
      details: { two_factor_required: true },
    })

    expect(error.details.two_factor_required).toBe(true)
    expect(error.kind).toBe('unauthorized')
  })

  it('ne plante pas sur un corps inattendu', () => {
    expect(apiErrorFromResponse(502, '<html>Bad Gateway</html>').message).toBe('HTTP 502')
    expect(apiErrorFromResponse(500, undefined).kind).toBe('server')
  })
})

describe('kindOf', () => {
  it.each([
    [0, 'network'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [409, 'conflict'],
    [429, 'rate_limited'],
    [503, 'server'],
    [400, 'client'],
  ])('statut %i → %s', (status, kind) => {
    expect(kindOf(status)).toBe(kind)
  })
})

describe('describeError', () => {
  it('traduit un message connu du back', () => {
    const error = new ApiError({ status: 401, message: 'Invalid credentials' })

    expect(describeError(error)).toBe('E-mail ou mot de passe incorrect.')
  })

  it('n\'affiche jamais le texte anglais inconnu du serveur', () => {
    const error = new ApiError({ status: 400, message: 'Some internal english sentence' })

    expect(describeError(error)).not.toContain('english')
  })

  it('reconnaît une panne réseau et une erreur non-API', () => {
    expect(describeError(new ApiError({ status: 0, message: 'x', kind: 'network' }))).toContain('joindre le serveur')
    expect(describeError(new Error('boom'))).toBe('Une erreur inattendue est survenue.')
    expect(isApiError(new Error('boom'))).toBe(false)
  })
})

describe('erreurs de problème Marinade', () => {
  it('range chaque erreur de champ sous son champ et garde le code stable', () => {
    const error = apiErrorFromResponse(422, {
      type: 'https://marinade.app/problems/stock.motif_obligatoire',
      code: 'stock.motif_obligatoire',
      detail: 'Indiquez le motif de ce mouvement.',
      errors: [{ field: 'motif', code: 'stock.motif_obligatoire', detail: 'Indiquez le motif de ce mouvement.' }],
    })

    expect(error.code).toBe('stock.motif_obligatoire')
    expect(error.fieldMessage('motif')).toBe('Indiquez le motif de ce mouvement.')
    expect(error.message).toBe('Indiquez le motif de ce mouvement.')
  })

  it('sans erreur de champ, garde le message et le code', () => {
    const error = apiErrorFromResponse(400, { code: 'stock.insufficient', detail: 'Stock insuffisant.' })

    expect(error.code).toBe('stock.insufficient')
    expect(error.fieldErrors).toEqual([])
    expect(error.message).toBe('Stock insuffisant.')
  })
})

describe('describeError avec un code métier', () => {
  it('affiche le message français d\'un code métier', () => {
    const error = apiErrorFromResponse(409, { code: 'stock.insufficient', detail: 'Stock insuffisant : il reste 3 kg.' })

    expect(describeError(error)).toBe('Stock insuffisant : il reste 3 kg.')
  })

  it('n\'affiche pas le texte brut d\'un code générique', () => {
    const error = apiErrorFromResponse(409, { code: 'http.conflict', detail: 'Conflict while saving' })

    expect(describeError(error)).toBe('Cette opération entre en conflit avec des données existantes.')
  })

  it('une session expirée reste traduite par le type d\'erreur', () => {
    const error = apiErrorFromResponse(401, { code: 'auth.session_expired', detail: 'Session expirée' })

    expect(describeError(error)).toBe('Votre session a expiré. Reconnectez-vous.')
  })

  it('une erreur serveur n\'expose jamais son message', () => {
    const error = apiErrorFromResponse(500, { code: 'stock.boom', detail: 'Traceback…' })

    expect(describeError(error)).toBe('Le serveur a rencontré un problème. Réessayez dans un instant.')
  })
})
