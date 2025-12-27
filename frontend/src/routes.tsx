import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ModernLayout } from './components/layout/ModernLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardModern } from './pages/DashboardModern';
import { DeviceAdd } from './pages/DeviceAdd';
import { Inventory } from './pages/Inventory';
import { InventoryModern } from './pages/InventoryModern';
import { Phonecheck } from './pages/Phonecheck';
import { CronJobManagementModern } from './pages/CronJobManagementModern';
import { AdminPanel } from './pages/AdminPanel';
import { DbIntegrityCheck } from './pages/DbIntegrityCheck';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { AdminApprovals } from './pages/AdminApprovals';
import { VerifyEmail } from './pages/VerifyEmail';
import { AccountSettings } from './pages/AccountSettings';
import { BulkVerification } from './pages/BulkVerification';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/verify-email',
    element: <VerifyEmail />,
  },
  // Root route: redirect to dashboard (which requires authentication)
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  // All protected routes (including dashboard)
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <ModernLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: <DashboardModern />,
      },
      {
        path: 'single-add',
        element: <DeviceAdd />,
      },
      {
        path: 'bulk-add',
        element: <DeviceAdd />,
      },
      {
        path: 'inventory',
        element: <InventoryModern />, // Modern Ant Design version
      },
      {
        path: 'phonecheck',
        element: <Phonecheck />,
      },
      // DEPRECATED/DEACTIVATED ROUTES - Commented out but kept for reference
      // {
      //   path: 'device-add',
      //   element: <DeviceAdd />, // Duplicate - use /single-add or /bulk-add instead
      // },
      // {
      //   path: 'inventory-old',
      //   element: <Inventory />, // Old version - replaced by /inventory
      // },
      // {
      //   path: 'sku-master',
      //   element: <div style={{ padding: 24 }}>SKU Master - Coming Soon</div>, // Placeholder - not implemented
      // },
      // {
      //   path: 'sku-matching',
      //   element: <div style={{ padding: 24 }}>SKU Matching - Coming Soon</div>, // Placeholder - not implemented
      // },
      // {
      //   path: 'data-cleanup',
      //   element: <div style={{ padding: 24 }}>Data Cleanup - Coming Soon</div>, // Placeholder - not implemented
      // },
      // {
      //   path: 'queue-management',
      //   element: <div style={{ padding: 24 }}>Queue Management - Coming Soon</div>, // Placeholder - not implemented
      // },
      {
        path: 'cron-jobs',
        element: <CronJobManagementModern />,
      },
      {
        path: 'admin-panel',
        element: <AdminPanel />,
      },
      {
        path: 'admin-approvals',
        element: <AdminApprovals />,
      },
      {
        path: 'db-integrity-check',
        element: <DbIntegrityCheck />,
      },
      // DEPRECATED/DEACTIVATED ROUTES - Placeholder routes not yet implemented
      // {
      //   path: 'reports',
      //   element: <div style={{ padding: 24 }}>Reports - Coming Soon</div>, // Placeholder - not implemented
      // },
      // {
      //   path: 'audit',
      //   element: <div style={{ padding: 24 }}>Audit Logs - Coming Soon</div>, // Placeholder - not implemented
      // },
      {
        path: 'account-settings',
        element: <AccountSettings />,
      },
      {
        path: 'bulk-verification',
        element: <BulkVerification />,
      },
    ],
  },
  // Catch-all route: redirect unknown paths
  {
    path: '*',
    element: (
      <ProtectedRoute>
        <ModernLayout>
          <div style={{ padding: 24, textAlign: 'center' }}>
            <h2>Page Not Found</h2>
            <p>The page you're looking for doesn't exist.</p>
          </div>
        </ModernLayout>
      </ProtectedRoute>
    ),
  },
]);
