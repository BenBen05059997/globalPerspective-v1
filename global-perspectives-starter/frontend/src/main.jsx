import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './bootstrapProxy.js'
import App from './App.jsx'

if (typeof window !== 'undefined' && !window.location.hash) {
  window.location.hash = '#/';
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
