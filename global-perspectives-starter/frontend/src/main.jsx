// global-perspectives-starter/frontend/src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/app/index.css'
import '@/app/bootstrapProxy.js'
import { installErrorSink } from '@/shared/api/errorSink.js'
import App from '@/app/App.jsx'

installErrorSink()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
