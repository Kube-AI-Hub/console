/**
 * Middleware to extract token from URL query parameter and set it to request
 * This allows passing Bearer token via query parameter instead of Authorization header
 * for cases where direct browser redirect is needed (e.g., OAuth authorize flow)
 */
module.exports = async (ctx, next) => {
    // Extract token from query parameter if present
    const tokenFromQuery = ctx.query.token

    if (tokenFromQuery) {
        // Also set Authorization header if not already present
        if (!ctx.headers.authorization) {
            ctx.headers.authorization = `Bearer ${tokenFromQuery}`
        }

        // Remove token from query string to avoid passing it to backend
        const query = { ...ctx.query }
        delete query.token

        // Rebuild URL without token parameter
        const queryString = Object.keys(query).length > 0
            ? '?' + new URLSearchParams(query).toString()
            : ''
        ctx.url = ctx.path + queryString
        ctx.req.url = ctx.url
    }

    await next()
}

