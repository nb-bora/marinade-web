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
