import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { ToastContainer } from './components/ui/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// Initialize auth with default user (for now)
import { useAuthStore } from './stores/authStore'
useAuthStore.getState().setUser({
  id: '1',
  name: 'Operator',
  role: 'OPERATOR',
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
      <ToastContainer />
    </ErrorBoundary>
  </StrictMode>,
)
