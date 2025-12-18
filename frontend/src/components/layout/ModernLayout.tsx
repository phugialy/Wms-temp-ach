import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Badge, Button, theme } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  PlusOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  SearchOutlined,
  TagsOutlined,
  LinkOutlined,
  ClearOutlined,
  UnorderedListOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  AuditOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';

const { Header: AntHeader, Sider, Content } = Layout;

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  section?: string;
  roles?: ('OPERATOR' | 'ADMIN' | 'MANAGER')[];
}

const navItems: NavItem[] = [
  // Operations
  { key: '/single-add', label: 'Single Add', icon: <PlusOutlined />, section: 'Operations' },
  { key: '/bulk-add', label: 'Bulk Add', icon: <AppstoreOutlined />, section: 'Operations' },
  { key: '/inventory', label: 'Inventory Manager', icon: <DatabaseOutlined />, section: 'Operations' },
  { key: '/phonecheck', label: 'Phonecheck Lookup', icon: <SearchOutlined />, section: 'Operations' },
  
  // Administration
  { key: '/sku-master', label: 'SKU Master', icon: <TagsOutlined />, section: 'Administration', roles: ['ADMIN'] },
  { key: '/sku-matching', label: 'SKU Matching', icon: <LinkOutlined />, section: 'Administration', roles: ['ADMIN'] },
  { key: '/data-cleanup', label: 'Data Cleanup', icon: <ClearOutlined />, section: 'Administration', roles: ['ADMIN'] },
  { key: '/queue-management', label: 'Queue Management', icon: <UnorderedListOutlined />, section: 'Administration', roles: ['ADMIN'] },
  { key: '/cron-jobs', label: 'Cron Job Management', icon: <ClockCircleOutlined />, section: 'Administration', roles: ['ADMIN', 'MANAGER'] },
  
  // Analytics
  { key: '/dashboard', label: 'Executive Dashboard', icon: <DashboardOutlined />, section: 'Analytics', roles: ['MANAGER', 'ADMIN'] },
  { key: '/reports', label: 'Reports', icon: <FileTextOutlined />, section: 'Analytics', roles: ['MANAGER', 'ADMIN'] },
  { key: '/audit', label: 'Audit Logs', icon: <AuditOutlined />, section: 'Analytics', roles: ['MANAGER', 'ADMIN'] },
];

export const ModernLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role || 'OPERATOR';
  const {
    token: { colorBgContainer, colorBorderSecondary },
  } = theme.useToken();

  // Filter items by role and group by section
  const filteredItems = navItems.filter(item => 
    !item.roles || item.roles.includes(userRole)
  );

  const groupedItems = filteredItems.reduce((acc, item) => {
    const section = item.section || 'Other';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  // Build menu items with sections
  const menuItems: MenuProps['items'] = Object.entries(groupedItems).map(([section, items]) => ({
    type: 'group',
    label: section,
    children: items.map(item => ({
      key: item.key,
      icon: item.icon,
      label: item.label,
    })),
  }));

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: () => {
        useAuthStore.getState().logout();
      },
    },
  ];

  const userName = user?.name || 'User';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={250}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
        theme="dark"
      >
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <div style={{ 
            fontSize: collapsed ? 20 : 24, 
            fontWeight: 'bold', 
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span>📦</span>
            {!collapsed && <span>WMS</span>}
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ borderRight: 0 }}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 250, transition: 'all 0.2s' }}>
        <AntHeader
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            borderBottom: `1px solid ${colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, width: 64, height: 64 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={5} size="small">
              <Button
                type="text"
                icon={<BellOutlined style={{ fontSize: 18 }} />}
                style={{ fontSize: 16 }}
              />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                cursor: 'pointer',
                padding: '4px 12px',
                borderRadius: 6,
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Avatar style={{ backgroundColor: '#1890ff' }}>{userInitial}</Avatar>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{userName}</span>
                  <span style={{ fontSize: 12, color: '#8c8c8c' }}>{userRole}</span>
                </div>
              </div>
            </Dropdown>
          </div>
        </AntHeader>
        <Content
          style={{
            margin: '24px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: 8,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

