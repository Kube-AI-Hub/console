const querystring = require('querystring')
const { getServerConfig } = require('../libs/utils')
const { decryptPassword } = require('../libs/utils')

const { server: serverConfig } = getServerConfig()
const { client: clientConfig } = getServerConfig()

/**
 * Middleware to inject clientID and clientSecret into /oauth/token requests
 * This prevents exposing credentials to the frontend while maintaining
 * compatibility with the backend OAuth API
 */
module.exports = async (ctx, next) => {
    // Only process POST requests to /oauth/token
    if (ctx.method === 'POST' && ctx.path === '/oauth/token') {
        let clientID = serverConfig.apiServer.clientID
        if (!clientID) {
            clientID = 'kubesphere'
        }

        let clientSecret = serverConfig.apiServer.clientSecret
        if (!clientSecret) {
            clientSecret = 'kubesphere'
        }

        // Parse request body (form-urlencoded)
        const contentType = ctx.headers['content-type'] || ''
        if (contentType.includes('application/x-www-form-urlencoded')) {
            // Body parser middleware should have already parsed it
            if (ctx.request.body && typeof ctx.request.body === 'object') {
                // Decrypt password if it's encrypted (frontend sends encrypted password)
                if (ctx.request.body.password) {
                    const encryptKey = clientConfig.encryptKey || 'kubesphere'
                    // Check if password is encrypted (contains '@' separator)
                    if (ctx.request.body.password.includes('@')) {
                        ctx.request.body.password = decryptPassword(ctx.request.body.password, encryptKey)
                    }
                }

                // Inject credentials if not already present
                if (!ctx.request.body.client_id) {
                    ctx.request.body.client_id = clientID
                }
                if (!ctx.request.body.client_secret) {
                    ctx.request.body.client_secret = clientSecret
                }

                // Re-serialize the body for proxy
                ctx.request.body = querystring.stringify(ctx.request.body)
                // Store the modified body so proxy can use it
                ctx.req.body = ctx.request.body
            }
        }
    }

    await next()
}
