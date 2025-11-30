import request from 'utils/request'
import { getToken, removeToken } from 'utils/token'

const setSessionLoading = loading => {
    window.__SESSION_LOADING__ = loading
}

if (typeof window !== 'undefined' && window.__SESSION_LOADING__ === undefined) {
    window.__SESSION_LOADING__ = false
}

export const applySessionContext = context => {
    if (!context || !context.user) {
        throw new Error('FAILED_TO_LOAD_SESSION_CONTEXT')
    }

    const { user, ksConfig, runtime, clusterRole, config } = context

    globals.user = user
    globals.ksConfig = ksConfig
    globals.runtime = runtime
    globals.clusterRole = clusterRole
    globals.config = { ...globals.config, ...config }

    if (globals.app && globals.app._cache_) {
        globals.app._cache_ = {}
    }
}

export const loadSessionContext = () =>
    request.get('session/context').then(context => {
        applySessionContext(context)
        return context
    })

export const ensureSessionContext = () => {
    const token = getToken()
    if (!token) {
        return Promise.resolve(null)
    }

    setSessionLoading(true)

    return loadSessionContext()
        .catch(err => {
            console.warn('Failed to load session context', err)
            removeToken()
            throw err
        })
        .finally(() => setSessionLoading(false))
}


