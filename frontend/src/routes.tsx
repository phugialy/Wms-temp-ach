import { createBrowserRouter } from 'react-router-dom';
import { ModernLayout } from './components/layout/ModernLayout';
import { DashboardModern } from './pages/DashboardModern';
import { DeviceAdd } from './pages/DeviceAdd';
import { Inventory } from './pages/Inventory';
import { InventoryModern } from './pages/InventoryModern';
import { Phonecheck } from './pages/Phonecheck';
import { CronJobManagementModern } from './pages/CronJobManagementModern';
import { AdminPanel } from './pages/AdminPanel';
import { DbIntegrityCheck } from './pages/DbIntegrityCheck';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ModernLayout />,
    children: [
      {
        index: true,
        element: <DashboardModern />,
      },
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
        path: 'device-add',
        element: <DeviceAdd />,
      },
      {
        path: 'inventory',
        element: <InventoryModern />, // Preview: Ant Design version
      },
      {
        path: 'inventory-old',
        element: <Inventory />, // Old version kept for reference
      },
      {
        path: 'phonecheck',
        element: <Phonecheck />,
      },
      // Placeholder routes for other pages
      {
        path: 'sku-master',
        element: <div style={{ padding: 24 }}>SKU Master - Coming Soon</div>,
      },
      {
        path: 'sku-matching',
        element: <div style={{ padding: 24 }}>SKU Matching - Coming Soon</div>,
      },
      {
        path: 'data-cleanup',
        element: <div style={{ padding: 24 }}>Data Cleanup - Coming Soon</div>,
      },
      {
        path: 'queue-management',
        element: <div style={{ padding: 24 }}>Queue Management - Coming Soon</div>,
      },
      {
        path: 'cron-jobs',
        element: <CronJobManagementModern />,
      },
      {
        path: 'admin-panel',
        element: <AdminPanel />,
      },
      {
        path: 'db-integrity-check',
        element: <DbIntegrityCheck />,
      },
      {
        path: 'reports',
        element: <div style={{ padding: 24 }}>Reports - Coming Soon</div>,
      },
      {
        path: 'audit',
        element: <div style={{ padding: 24 }}>Audit Logs - Coming Soon</div>,
      },
    ],
  },
]);

