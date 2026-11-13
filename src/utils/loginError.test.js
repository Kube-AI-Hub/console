/*
 * Copyright 2026 Kube AI Hub.
 */

import { isLoginRequestUrl, mapOAuthLoginMessage } from './loginError'

describe('isLoginRequestUrl', () => {
  it('matches oauth token and login paths', () => {
    expect(isLoginRequestUrl('/oauth/token')).toBe(true)
    expect(isLoginRequestUrl('/login')).toBe(true)
    expect(isLoginRequestUrl('/kapis/resources.kubesphere.io/v1alpha3/users')).toBe(
      false
    )
  })
})

describe('mapOAuthLoginMessage', () => {
  it('maps auth rate limit (HTTP 429) to TOO_MANY_FAILURES', () => {
    expect(
      mapOAuthLoginMessage(
        {
          error: 'invalid_grant',
          error_description: 'auth rate limit exceeded',
        },
        429
      )
    ).toBe('TOO_MANY_FAILURES')
  })

  it('maps rate-limit text even when status is 400', () => {
    expect(
      mapOAuthLoginMessage(
        {
          error: 'invalid_grant',
          error_description: 'auth rate limit exceeded',
        },
        400
      )
    ).toBe('TOO_MANY_FAILURES')
  })

  it('maps incorrect password', () => {
    expect(
      mapOAuthLoginMessage(
        {
          error: 'invalid_grant',
          error_description: 'incorrect password',
        },
        400
      )
    ).toBe('INCORRECT_PASSWORD')
  })

  it('maps unknown invalid_grant to generic credentials message', () => {
    expect(
      mapOAuthLoginMessage({ error: 'invalid_grant', error_description: '' }, 400)
    ).toBe('INCORRECT_USERNAME_OR_PASSWORD')
  })

  it('falls back to LOGIN_FAILED', () => {
    expect(mapOAuthLoginMessage({}, 418)).toBe('LOGIN_FAILED')
  })
})
