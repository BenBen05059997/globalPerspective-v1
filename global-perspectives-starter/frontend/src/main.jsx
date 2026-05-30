// global-perspectives-starter/frontend/src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './bootstrapProxy.js'
import { installErrorSink } from './services/errorSink.js'
import App from './App.jsx'

installErrorSink()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
