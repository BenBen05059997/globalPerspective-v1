// Bootstrap REST proxy configuration from window globals and add console test hooks
import { configureProxy, geocodeProxy } from './services/restProxy.js'

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

  // Quick smoke test from console: window.testProxyGeocode('Kyiv, Ukraine')
  window.testProxyGeocode = async (address) => {
    try {
      const res = await geocodeProxy(address)
      console.log('[REST Proxy] geocodeProxy result:', res)
      return res
    } catch (error) {
      console.error('[REST Proxy] geocodeProxy error:', error)
      throw error
    }
  }
})()