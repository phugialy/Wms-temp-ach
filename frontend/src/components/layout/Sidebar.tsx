import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  section?: string;
  roles?: ('OPERATOR' | 'ADMIN' | 'MANAGER')[];
}

const navItems: NavItem[] = [
  // Operations
  { path: '/single-add', label: 'Single Add', icon: 'fas fa-mobile-alt', section: 'Operations' },
  { path: '/bulk-add', label: 'Bulk Add', icon: 'fas fa-layer-group', section: 'Operations' },
  { path: '/inventory', label: 'Inventory Manager', icon: 'fas fa-boxes', section: 'Operations' },
  { path: '/phonecheck', label: 'Phonecheck Lookup', icon: 'fas fa-search', section: 'Operations' },
  
  // Administration
  { path: '/sku-master', label: 'SKU Master', icon: 'fas fa-tags', section: 'Administration', roles: ['ADMIN'] },
  { path: '/sku-matching', label: 'SKU Matching', icon: 'fas fa-link', section: 'Administration', roles: ['ADMIN'] },
  { path: '/data-cleanup', label: 'Data Cleanup', icon: 'fas fa-broom', section: 'Administration', roles: ['ADMIN'] },
  { path: '/queue-management', label: 'Queue Management', icon: 'fas fa-tasks', section: 'Administration', roles: ['ADMIN'] },
  { path: '/cron-jobs', label: 'Cron Job Management', icon: 'fas fa-clock', section: 'Administration', roles: ['ADMIN', 'MANAGER'] },
  
  // Analytics
  { path: '/dashboard', label: 'Executive Dashboard', icon: 'fas fa-chart-line', section: 'Analytics', roles: ['MANAGER', 'ADMIN'] },
  { path: '/reports', label: 'Reports', icon: 'fas fa-file-chart-line', section: 'Analytics', roles: ['MANAGER', 'ADMIN'] },
  { path: '/audit', label: 'Audit Logs', icon: 'fas fa-clipboard-check', section: 'Analytics', roles: ['MANAGER', 'ADMIN'] },
];

export const Sidebar = () => {
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role || 'OPERATOR';

  // Group items by section
  const groupedItems = navItems.reduce((acc, item) => {
    // Filter by role
    if (item.roles && !item.roles.includes(userRole)) {
      return acc;
    }

    const section = item.section || 'Other';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
        style={{ display: 'none' }}
        id="sidebar-overlay"
        onClick={() => {
          const sidebar = document.querySelector('aside');
          sidebar?.classList.remove('sidebar-open');
          const overlay = document.getElementById('sidebar-overlay');
          if (overlay) overlay.style.display = 'none';
        }}
      ></div>

      <aside 
        className="fixed left-0 top-0 h-screen text-white overflow-y-auto z-50 transition-transform duration-300"
        style={{
          width: 'var(--sidebar-width)',
          background: 'var(--sidebar-bg)',
          transform: 'translateX(-100%)',
        }}
        id="sidebar"
      >
      {/* Sidebar Header */}
      <div 
        className="p-5 border-b flex items-center gap-3"
        style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <i className="fas fa-warehouse text-2xl" style={{ color: 'var(--primary-500)' }}></i>
        <div className="text-xl font-bold">WMS</div>
      </div>

      {/* Navigation */}
      <nav className="p-4">
        {Object.entries(groupedItems).map(([section, items]) => (
          <div key={section} className="mb-6">
            <div 
              className="px-5 py-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'rgba(255, 255, 255, 0.5)' }}
            >
              {section}
            </div>
            {items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => {
                  const baseClasses = 'flex items-center px-5 py-3 mb-1 transition-all duration-200 cursor-pointer';
                  const activeClasses = isActive
                    ? 'text-white font-medium'
                    : 'text-white/80 hover:text-white';
                  
                  return `${baseClasses} ${activeClasses}`;
                }}
                style={({ isActive }) => ({
                  borderLeft: isActive ? '3px solid var(--primary-500)' : '3px solid transparent',
                  background: isActive ? 'var(--sidebar-hover)' : 'transparent',
                })}
                onMouseEnter={(e) => {
                  const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--sidebar-hover)';
                    e.currentTarget.style.borderLeftColor = 'var(--primary-500)';
                  }
                }}
                onMouseLeave={(e) => {
                  const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderLeftColor = 'transparent';
                  }
                }}
              >
                <i className={`${item.icon} mr-3`} style={{ width: '20px', fontSize: '16px' }}></i>
                <span className="flex-1">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      </aside>

      <style>{`
        aside::-webkit-scrollbar {
          width: 6px;
        }
        aside::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
        }
        aside::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
        }
        aside::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }

        /* Desktop: Always visible */
        @media (min-width: 1024px) {
          aside {
            transform: translateX(0) !important;
          }
        }

        /* Mobile: Toggle with class */
        @media (max-width: 1023px) {
          aside.sidebar-open {
            transform: translateX(0) !important;
          }
          
          #sidebar-overlay {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
};

export default Sidebar;

