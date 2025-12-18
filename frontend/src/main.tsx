import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider, App } from 'antd'
import dayjs from 'dayjs'
import 'dayjs/locale/en'
import { router } from './routes'
import { ToastContainer } from './components/ui/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// Configure dayjs
dayjs.locale('en')

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
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#1890ff',
            borderRadius: 6,
          },
        }}
      >
        <App>
          <RouterProvider router={router} />
          <ToastContainer />
        </App>
      </ConfigProvider>
    </ErrorBoundary>
  </StrictMode>,
)
