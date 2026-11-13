/*
 * Copyright 2026 Kube AI Hub.
 *
 * Map OAuth /oauth/token failures to login-page i18n keys.
 * ks-apiserver returns English error_description values that are not
 * versioned; match them loosely and never surface the raw key or English
 * blob when we have a known case.
 */

export function isLoginRequestUrl(url) {
  if (!url) {
    return false
  }
  return url.includes('/login') || url.includes('/oauth/')
}

/**
 * @param {{ error?: string, error_description?: string, message?: string }} data
 * @param {number} [status]
 * @returns {string} i18n key for the login Alert
 */
export function mapOAuthLoginMessage(data = {}, status) {
  const errorDesc = String(data.error_description || '').toLowerCase()
  const error = String(data.error || '').toLowerCase()

  if (
    status === 429 ||
    errorDesc.includes('rate limit') ||
    errorDesc.includes('too many')
  ) {
    return 'TOO_MANY_FAILURES'
  }

  if (errorDesc.includes('incorrect password')) {
    return 'INCORRECT_PASSWORD'
  }

  if (
    errorDesc.includes('user not found') ||
    errorDesc.includes('user does not exist')
  ) {
    return 'USER_NOT_FOUND'
  }

  if (error === 'invalid_grant') {
    return 'INCORRECT_USERNAME_OR_PASSWORD'
  }

  if (error === 'invalid_client') {
    return 'FAILED_TO_ACCESS_BACKEND'
  }

  if (status >= 500) {
    return 'FAILED_TO_ACCESS_API_SERVER'
  }

  return 'LOGIN_FAILED'
}
