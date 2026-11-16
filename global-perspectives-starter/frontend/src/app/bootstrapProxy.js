// Bootstrap REST proxy configuration from window globals
import { configureProxy } from '@/shared/api/restProxy.js'

(() => {
  const endpoint = window.SENSITIVE_PROXY_ENDPOINT

  if (endpoint) {
    try {
      configureProxy({ endpoint })
      window.RestProxyReady = true
      console.info('[REST Proxy] Configured from window globals. Ready:', window.RestProxyReady)
    } catch (err) {
      console.error('[REST Proxy] Failed to configure:', err)
    }
  } else {
    console.warn('[REST Proxy] Missing window.SENSITIVE_PROXY_ENDPOINT. Set it to your API Gateway invoke URL.')
  }
})()