import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { DataVersionProvider } from './context/DataVersionContext'
import { ToastProvider } from './components/Toast'
import './styles/global.css'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <DataVersionProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </DataVersionProvider>
  </StrictMode>
)
