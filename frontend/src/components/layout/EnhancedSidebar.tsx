/**
 * Enhanced Sidebar Component
 * Smooth collapse/expand with SaaS-style animations
 * Can be used by DashboardLayout for consistent behavior
 */

import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  { path: '/admin-panel', label: 'Admin Panel', icon: 'fas fa-cog', section: 'Administration', roles: ['ADMIN', 'MANAGER'] },
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

interface EnhancedSidebarProps {
  collapsed: boolean;
  onToggle?: () => void;
}

export const EnhancedSidebar = ({ collapsed, onToggle }: EnhancedSidebarProps) => {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role || 'OPERATOR';

  // Group items by section
  const groupedItems = navItems.reduce((acc, item) => {
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

  const sidebarWidth = collapsed ? 80 : 260;

  return (
    <>
      <aside 
        className="fixed left-0 top-0 h-screen text-white overflow-hidden z-50"
        style={{
          width: `${sidebarWidth}px`,
          background: 'var(--sidebar-bg)',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* Sidebar Header */}
        <div 
          className="flex items-center justify-center border-b relative"
          style={{ 
            height: 64,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            padding: collapsed ? '0 20px' : '0 24px',
            transition: 'padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div 
            className="flex items-center gap-3 overflow-hidden"
            style={{
              transition: 'opacity 0.2s ease',
            }}
          >
            <i 
              className="fas fa-warehouse" 
              style={{ 
                color: 'var(--primary-500)',
                fontSize: collapsed ? '20px' : '24px',
                transition: 'font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }} 
            />
            <span 
              className="text-xl font-bold whitespace-nowrap"
              style={{
                opacity: collapsed ? 0 : 1,
                width: collapsed ? 0 : 'auto',
                transition: 'opacity 0.2s ease, width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
              }}
            >
              WMS
            </span>
          </div>
          
          {/* Collapse Toggle Button */}
          {onToggle && (
            <button
              onClick={onToggle}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-white/10 transition-colors"
              style={{
                opacity: collapsed ? 1 : 0.7,
              }}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <i 
                className={`fas fa-chevron-${collapsed ? 'right' : 'left'}`}
                style={{ fontSize: '12px' }}
              />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav 
          className="overflow-y-auto h-[calc(100vh-64px)]"
          style={{
            padding: collapsed ? '16px 12px' : '16px',
            transition: 'padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {Object.entries(groupedItems).map(([section, items]) => (
            <div key={section} className="mb-6">
              {/* Section Header */}
              {!collapsed && (
                <div 
                  className="px-5 py-2 text-xs font-semibold uppercase tracking-wider"
                  style={{ 
                    color: 'rgba(255, 255, 255, 0.5)',
                    opacity: collapsed ? 0 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  {section}
                </div>
              )}
              
              {/* Navigation Items */}
              {items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className="flex items-center mb-1 rounded-lg transition-all duration-200 cursor-pointer relative group"
                    style={{
                      padding: collapsed ? '12px' : '12px 20px',
                      borderLeft: isActive ? '3px solid var(--primary-500)' : '3px solid transparent',
                      background: isActive ? 'var(--sidebar-hover)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--sidebar-hover)';
                        e.currentTarget.style.borderLeftColor = 'var(--primary-500)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderLeftColor = 'transparent';
                      }
                    }}
                  >
                    <i 
                      className={item.icon}
                      style={{ 
                        width: '20px',
                        fontSize: '16px',
                        textAlign: 'center',
                        flexShrink: 0,
                      }}
                    />
                    <span 
                      className="ml-3 font-medium whitespace-nowrap"
                      style={{
                        opacity: collapsed ? 0 : 1,
                        width: collapsed ? 0 : 'auto',
                        overflow: 'hidden',
                        transition: 'opacity 0.2s ease, width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      {item.label}
                    </span>
                    
                    {/* Tooltip on hover when collapsed */}
                    {collapsed && (
                      <div
                        className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
                        style={{
                          transition: 'opacity 0.2s ease',
                        }}
                      >
                        {item.label}
                        <div 
                          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 transform rotate-45"
                        />
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Smooth scrollbar styling */}
        <style>{`
          aside nav::-webkit-scrollbar {
            width: 6px;
          }
          aside nav::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
          }
          aside nav::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            transition: background 0.2s ease;
          }
          aside nav::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
          }
        `}</style>
      </aside>
      
      {/* Overlay for mobile */}
      {!collapsed && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
          onClick={onToggle}
          style={{ display: 'none' }}
          id="sidebar-overlay"
        />
      )}
    </>
  );
};

export default EnhancedSidebar;


