const net = require('net')

function isPortOpen({ host, port, timeoutMs = 250 }) {
  return new Promise(resolve => {
    const socket = new net.Socket()

    const done = ok => {
      socket.removeAllListeners()
      try {
        socket.destroy()
      } catch (e) {
        // ignore
      }
      resolve(ok)
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))

    socket.connect(port, host)
  })
}

async function main() {
  const targets = [
    { key: 'server', host: '127.0.0.1', port: 8000, url: 'http://localhost:8000' },
    { key: 'client', host: '127.0.0.1', port: 8001, url: 'http://localhost:8001' },
    { key: 'docs', host: '127.0.0.1', port: 1313, url: 'http://localhost:1313/kube-docs/' },
  ]

  const printed = new Set()
  const startedAt = Date.now()

  /* eslint-disable no-console */
  console.log('Waiting for dev servers to be ready...')

  // Poll until each port opens; print each URL once.
  // Keep process alive afterwards so concurrently -k doesn't stop others.
  while (printed.size < targets.length) {
    // eslint-disable-next-line no-await-in-loop
    const checks = await Promise.all(
      targets.map(t => isPortOpen({ host: t.host, port: t.port }))
    )

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]
      if (checks[i] && !printed.has(t.key)) {
        printed.add(t.key)
        console.log(`[ready] ${t.key}: ${t.url}`)
      }
    }

    if (printed.size < targets.length) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 500))
    }
  }

  const seconds = Math.round((Date.now() - startedAt) / 1000)
  console.log(`All dev endpoints are ready (≈${seconds}s).`)
  await new Promise(r => setTimeout(r, 2000))
  const green = s => `\u001b[32m${s}\u001b[0m`
  console.log(green('Dev endpoints:'))
  for (const t of targets) {
    console.log(green(`- ${t.key}: ${t.url}`))
  }

  const keepAlive = () => setTimeout(keepAlive, 60 * 60 * 1000)
  keepAlive()
}

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))

main().catch(err => {
  // Never fail the overall "start" command.
  /* eslint-disable no-console */
  console.log('[print-dev-urls] error:', err && err.message ? err.message : err)
  const keepAlive = () => setTimeout(keepAlive, 60 * 60 * 1000)
  keepAlive()
})

