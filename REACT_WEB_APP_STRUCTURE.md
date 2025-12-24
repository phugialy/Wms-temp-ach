# React Web App Structure - Component-Based Architecture

## Overview

The WMS application is built as a **unified React web application** using TypeScript and Ant Design components. All features are accessible through React Router navigation, providing a cohesive web-app experience.

## Architecture

### Primary Entry Point

- **React App**: `frontend/src/main.tsx` → Renders the entire application
- **Index HTML**: `frontend/index.html` → React app container
- **Router**: React Router v6 with `ModernLayout` as the main layout wrapper

### Component-Based Structure

All features are React/TSX components:

```
frontend/src/pages/
├── Dashboard.tsx              # Executive dashboard
├── SingleAdd.tsx              # Single device add
├── BulkAdd.tsx                # Bulk device add
├── Inventory.tsx              # Inventory management
├── Phonecheck.tsx             # Phonecheck lookup
├── AdminPanel.tsx             # Admin panel (main hub)
├── DbIntegrityCheck.tsx       # Database integrity check
└── CronJobManagementModern.tsx # Cron jobs management
```

### Layout System

**ModernLayout** (`frontend/src/components/layout/ModernLayout.tsx`):
- Ant Design Layout component
- Sidebar navigation with grouped menu items
- Header with user menu and notifications
- Content area with `<Outlet />` for route rendering
- Responsive design (collapsible sidebar)

### Navigation Structure

All navigation uses **React Router** (`NavLink` / `useNavigate`):

**Operations Section:**
- `/` or `/dashboard` - Executive Dashboard
- `/single-add` - Single Add
- `/bulk-add` - Bulk Add
- `/inventory` - Inventory Manager
- `/phonecheck` - Phonecheck Lookup

**Administration Section:**
- `/admin-panel` - **Admin Panel** (main hub with tabs)
  - Overview tab
  - Cron Jobs tab
  - DB Integrity Check tab
- `/cron-jobs` - Cron Job Management (also accessible standalone)
- `/db-integrity-check` - Database Integrity Check (also accessible standalone)
- `/sku-master` - SKU Master (Coming Soon)
- `/sku-matching` - SKU Matching (Coming Soon)
- `/data-cleanup` - Data Cleanup (Coming Soon)
- `/queue-management` - Queue Management (Coming Soon)

**Analytics Section:**
- `/dashboard` - Executive Dashboard
- `/reports` - Reports (Coming Soon)
- `/audit` - Audit Logs (Coming Soon)

## Admin Panel Structure

The Admin Panel (`/admin-panel`) is a **unified hub** with tabbed interface:

1. **Overview Tab**: 
   - Feature cards with quick access
   - Quick action buttons
   - System status overview

2. **Cron Jobs Tab**:
   - Full `CronJobManagementModern` component embedded
   - All cron job management features

3. **DB Integrity Check Tab**:
   - Full `DbIntegrityCheck` component embedded
   - Database scanning and fixing tools

## Technology Stack

- **React 18** with TypeScript
- **Ant Design** - UI component library (primary)
- **React Router v6** - Navigation and routing
- **Zustand** - State management (auth, toast)
- **Axios** - API client
- **Day.js** - Date handling
- **Chart.js** - Dashboard charts

## Access Points

### Development
```
http://localhost:3000/  (React dev server)
```

### Production
```
http://localhost:3001/  (Express serves React build)
```

All routes work through React Router - no direct HTML file access needed.

## Key Principles

1. **Component-Based**: All features are React components
2. **Single Page Application**: No page reloads, smooth transitions
3. **Unified Design**: Consistent Ant Design styling throughout
4. **Router-Based Navigation**: All navigation uses React Router
5. **Type-Safe**: Full TypeScript support
6. **Role-Based Access**: Navigation items filtered by user role

## Legacy HTML Files

The `public/` folder contains standalone HTML files for:
- Backward compatibility
- Legacy integrations
- Testing/debugging

**These are NOT part of the main web-app experience.** The React app is the primary interface.

## Adding New Features

1. Create new component in `frontend/src/pages/`
2. Add route in `frontend/src/routes.tsx`
3. Add navigation item in `frontend/src/components/layout/ModernLayout.tsx`
4. Use Ant Design components for consistency

## Component Naming Conventions

- **Pages**: PascalCase (e.g., `AdminPanel.tsx`)
- **Components**: PascalCase (e.g., `ModernLayout.tsx`)
- **Routes**: kebab-case (e.g., `/admin-panel`)
- **Navigation Labels**: Title Case (e.g., "Admin Panel")

## Development Workflow

1. Start React dev server: `cd frontend && npm run dev`
2. Navigate to `http://localhost:3000`
3. Use React Router links for navigation
4. All features accessible through sidebar menu
5. Admin Panel provides unified admin tools interface

