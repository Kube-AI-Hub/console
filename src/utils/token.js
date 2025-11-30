import { Base64 } from 'js-base64'
import { get } from 'lodash'

const TOKEN_KEY = 'kah_token'

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch (e) {
    console.error('Failed to get token from localStorage', e)
    return null
  }
}

export const setToken = (token) => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
      // Also set global token for compatibility
      if (typeof globals !== 'undefined') {
        globals.token = token
      }
    }
  } catch (e) {
    console.error('Failed to set token to localStorage', e)
  }
}

export const removeToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY)
    // Also clear global token
    if (typeof globals !== 'undefined') {
      globals.token = null
    }
  } catch (e) {
    console.error('Failed to remove token from localStorage', e)
  }
}

export const hasToken = () => {
  return !!getToken()
}

/**
 * Parse JWT token to extract user information
 * @param {string} token - JWT access token
 * @returns {object} User information extracted from token
 */
export const parseToken = (token) => {
  if (!token) {
    return null
  }

  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // Decode payload (second part)
    const payload = parts[1]
    // Replace URL-safe base64 characters
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = Base64.decode(base64)
    const parsed = JSON.parse(decoded)

    const { username, extra = {}, groups = [] } = parsed
    const email = get(extra, 'email[0]')
    const initialized = get(extra, 'uninitialized[0]') !== 'true'
    const extraname = get(extra, 'username[0]') || get(extra, 'uid[0]')

    return {
      username,
      email,
      groups,
      extraname,
      initialized,
      token,
    }
  } catch (e) {
    console.error('Failed to parse token', e)
    return null
  }
}

