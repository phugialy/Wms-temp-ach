import { createBrowserRouter } from 'react-router-dom';
import { ModernLayout } from './components/layout/ModernLayout';
import { Dashboard } from './pages/Dashboard';
import { SingleAdd } from './pages/SingleAdd';
import { BulkAdd } from './pages/BulkAdd';
import { Inventory } from './pages/Inventory';
import { Phonecheck } from './pages/Phonecheck';
import { CronJobManagementModern } from './pages/CronJobManagementModern';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ModernLayout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'single-add',
        element: <SingleAdd />,
      },
      {
        path: 'bulk-add',
        element: <BulkAdd />,
      },
      {
        path: 'inventory',
        element: <Inventory />,
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

