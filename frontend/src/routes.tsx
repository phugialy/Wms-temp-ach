import { createBrowserRouter } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { SingleAdd } from './pages/SingleAdd';
import { BulkAdd } from './pages/BulkAdd';
import { Inventory } from './pages/Inventory';
import { Phonecheck } from './pages/Phonecheck';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
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
        element: <div className="p-6">SKU Master - Coming Soon</div>,
      },
      {
        path: 'sku-matching',
        element: <div className="p-6">SKU Matching - Coming Soon</div>,
      },
      {
        path: 'data-cleanup',
        element: <div className="p-6">Data Cleanup - Coming Soon</div>,
      },
      {
        path: 'queue-management',
        element: <div className="p-6">Queue Management - Coming Soon</div>,
      },
      {
        path: 'reports',
        element: <div className="p-6">Reports - Coming Soon</div>,
      },
      {
        path: 'audit',
        element: <div className="p-6">Audit Logs - Coming Soon</div>,
      },
    ],
  },
]);

