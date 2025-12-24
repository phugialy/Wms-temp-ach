/**
 * Shared Theme Configuration
 * Ensures UI synchronization across both layout systems
 */

// Map to CSS variables defined in saas-theme.css
export const themeConfig = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6', // Main primary color
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    sidebar: {
      bg: '#1e293b',
      hover: '#334155',
      width: '260px',
    },
    status: {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  transitions: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },
} as const;

/**
 * Ant Design theme configuration
 * Maps to shared theme values for consistency
 */
export const antdThemeConfig = {
  token: {
    // Colors
    colorPrimary: themeConfig.colors.primary[500], // #3b82f6
    colorSuccess: themeConfig.colors.status.success,
    colorError: themeConfig.colors.status.error,
    colorWarning: themeConfig.colors.status.warning,
    colorInfo: themeConfig.colors.status.info,
    
    // Spacing
    borderRadius: 8, // themeConfig.borderRadius.md
    
    // Background
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    
    // Border
    colorBorder: themeConfig.colors.gray[200],
    colorBorderSecondary: themeConfig.colors.gray[200],
    
    // Typography
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
    fontSize: 14,
    
    // Layout
    wireframe: false,
  },
  components: {
    Layout: {
      bodyBg: '#ffffff',
      headerBg: '#ffffff',
      siderBg: themeConfig.colors.sidebar.bg,
    },
    Menu: {
      darkItemBg: themeConfig.colors.sidebar.bg,
      darkItemHoverBg: themeConfig.colors.sidebar.hover,
      darkItemSelectedBg: themeConfig.colors.sidebar.hover,
      darkItemSelectedColor: '#ffffff',
    },
  },
};

/**
 * Tailwind/CSS variable mapping
 * Use these in DashboardLayout and custom components
 */
export const cssVariables = {
  '--primary-500': themeConfig.colors.primary[500],
  '--primary-600': themeConfig.colors.primary[600],
  '--sidebar-width': themeConfig.colors.sidebar.width,
  '--sidebar-bg': themeConfig.colors.sidebar.bg,
  '--sidebar-hover': themeConfig.colors.sidebar.hover,
  '--spacing-lg': themeConfig.spacing.lg,
  '--radius-md': themeConfig.borderRadius.md,
} as const;

