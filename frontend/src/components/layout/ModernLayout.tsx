import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Badge, Button, theme, Modal, Form, Switch, Select, Divider, Typography, Space, message } from 'antd';
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
  SettingOutlined,
  DownOutlined,
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
  // Primary Operations - Most Important (Top Priority)
  { key: '/dashboard', label: 'Dashboard', icon: <DashboardOutlined />, section: 'Primary', roles: ['MANAGER', 'ADMIN', 'OPERATOR'] },
  { key: '/device-add', label: 'Add Devices', icon: <PlusOutlined />, section: 'Primary' },
  { key: '/inventory', label: 'Inventory', icon: <DatabaseOutlined />, section: 'Primary' },
  { key: '/phonecheck', label: 'Phonecheck', icon: <SearchOutlined />, section: 'Primary' },
  
  // Administration - Secondary Priority
  { key: '/admin-panel', label: 'Admin Panel', icon: <SettingOutlined />, section: 'Administration', roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
  { key: '/cron-jobs', label: 'Cron Jobs', icon: <ClockCircleOutlined />, section: 'Administration', roles: ['ADMIN', 'MANAGER'] },
  { key: '/sku-master', label: 'SKU Master', icon: <TagsOutlined />, section: 'Administration', roles: ['ADMIN'] },
  { key: '/sku-matching', label: 'SKU Matching', icon: <LinkOutlined />, section: 'Administration', roles: ['ADMIN'] },
  { key: '/queue-management', label: 'Queue Management', icon: <UnorderedListOutlined />, section: 'Administration', roles: ['ADMIN'] },
  { key: '/data-cleanup', label: 'Data Cleanup', icon: <ClearOutlined />, section: 'Administration', roles: ['ADMIN'] },
  
  // Analytics & Reports - Lower Priority
  { key: '/reports', label: 'Reports', icon: <FileTextOutlined />, section: 'Analytics', roles: ['MANAGER', 'ADMIN'] },
  { key: '/audit', label: 'Audit Logs', icon: <AuditOutlined />, section: 'Analytics', roles: ['MANAGER', 'ADMIN'] },
];

export const ModernLayout = () => {
  // Load collapsed state from localStorage for persistence
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  
  // Page settings modal state
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsForm] = Form.useForm();
  
  // Load page settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('page-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        settingsForm.setFieldsValue(settings);
      } catch (e) {
        console.error('Error loading page settings:', e);
      }
    }
  }, [settingsForm]);
  
  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(collapsed));
  }, [collapsed]);
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
      key: 'account-settings',
      icon: <SettingOutlined />,
      label: 'Account Settings',
      onClick: () => navigate('/account-settings'),
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

  const handleSettingsSave = (values: any) => {
    localStorage.setItem('page-settings', JSON.stringify(values));
    
    // Apply settings dynamically
    if (values.defaultSidebarCollapsed !== undefined) {
      setCollapsed(values.defaultSidebarCollapsed);
    }
    
    setSettingsVisible(false);
    message.success('Page settings saved successfully!');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={250}
        collapsedWidth={80}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
            gap: collapsed ? 0 : 12,
            transition: 'gap 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            justifyContent: 'center',
          }}>
            <span>📦</span>
            <span style={{
              opacity: collapsed ? 0 : 1,
              width: collapsed ? 0 : 'auto',
              overflow: 'hidden',
              transition: 'opacity 0.2s ease, width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}>
              {!collapsed && 'WMS'}
            </span>
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
      <Layout style={{ 
        marginLeft: collapsed ? 80 : 250, 
        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
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
            style={{ 
              fontSize: 16, 
              width: 64, 
              height: 64,
              transition: 'all 0.2s ease',
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Page Settings Button */}
            <Button
              type="text"
              icon={<SettingOutlined style={{ fontSize: 18 }} />}
              onClick={() => setSettingsVisible(true)}
              style={{
                fontSize: 16,
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Page Settings"
              title="Page Settings"
            />

            {/* Notifications Button */}
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'notification-1',
                    label: (
                      <div style={{ padding: '4px 0' }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>New device added</div>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                          2 minutes ago
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'notification-2',
                    label: (
                      <div style={{ padding: '4px 0' }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>Bulk import completed</div>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                          15 minutes ago
                        </div>
                      </div>
                    ),
                  },
                  {
                    type: 'divider',
                  },
                  {
                    key: 'view-all',
                    label: 'View all notifications',
                    style: { textAlign: 'center' },
                  },
                ],
              }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Badge count={5} size="small" offset={[-2, 2]}>
                <Button
                  type="text"
                  icon={<BellOutlined style={{ fontSize: 18 }} />}
                  style={{
                    fontSize: 16,
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Notifications"
                />
              </Badge>
            </Dropdown>

            {/* User Menu */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Button
                type="text"
                style={{
                  height: 'auto',
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Avatar
                  style={{
                    backgroundColor: '#1890ff',
                    flexShrink: 0,
                  }}
                  size="small"
                >
                  {userInitial}
                </Avatar>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    lineHeight: 1.2,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0, 0, 0, 0.88)' }}>
                    {userName}
                  </span>
                  <span style={{ fontSize: 12, color: '#8c8c8c' }}>{userRole}</span>
                </div>
                <DownOutlined
                  style={{
                    fontSize: 12,
                    color: '#8c8c8c',
                    marginLeft: 4,
                  }}
                />
              </Button>
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

      {/* Page Settings Modal */}
      <Modal
        title={
          <Space>
            <SettingOutlined />
            <span>Page Settings</span>
          </Space>
        }
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        onOk={() => settingsForm.submit()}
        okText="Save Settings"
        cancelText="Cancel"
        width={600}
      >
        <Form
          form={settingsForm}
          layout="vertical"
          onFinish={handleSettingsSave}
          initialValues={{
            compactMode: false,
            showBreadcrumbs: true,
            itemsPerPage: 20,
            autoRefresh: false,
            refreshInterval: 30,
            density: 'comfortable',
          }}
        >
          <Typography.Title level={5}>Display Settings</Typography.Title>
          <Form.Item
            label="Compact Mode"
            name="compactMode"
            valuePropName="checked"
            tooltip="Reduce spacing and padding for a more compact view"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="Show Breadcrumbs"
            name="showBreadcrumbs"
            valuePropName="checked"
            tooltip="Display breadcrumb navigation at the top of pages"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="Table Density"
            name="density"
            tooltip="Control the spacing in data tables"
          >
            <Select>
              <Select.Option value="comfortable">Comfortable</Select.Option>
              <Select.Option value="compact">Compact</Select.Option>
              <Select.Option value="spacious">Spacious</Select.Option>
            </Select>
          </Form.Item>

          <Divider />

          <Typography.Title level={5}>Data Settings</Typography.Title>
          <Form.Item
            label="Items Per Page"
            name="itemsPerPage"
            tooltip="Default number of items to show per page in tables"
          >
            <Select>
              <Select.Option value={10}>10</Select.Option>
              <Select.Option value={20}>20</Select.Option>
              <Select.Option value={50}>50</Select.Option>
              <Select.Option value={100}>100</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Auto Refresh"
            name="autoRefresh"
            valuePropName="checked"
            tooltip="Automatically refresh data at regular intervals"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.autoRefresh !== currentValues.autoRefresh}
          >
            {({ getFieldValue }) =>
              getFieldValue('autoRefresh') ? (
                <Form.Item
                  label="Refresh Interval (seconds)"
                  name="refreshInterval"
                  tooltip="How often to automatically refresh data"
                >
                  <Select>
                    <Select.Option value={10}>10 seconds</Select.Option>
                    <Select.Option value={30}>30 seconds</Select.Option>
                    <Select.Option value={60}>1 minute</Select.Option>
                    <Select.Option value={300}>5 minutes</Select.Option>
                  </Select>
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Divider />

          <Typography.Title level={5}>Sidebar Settings</Typography.Title>
          <Form.Item
            label="Default Sidebar State"
            name="defaultSidebarCollapsed"
            tooltip="How the sidebar should appear when you first load the page"
          >
            <Select>
              <Select.Option value={false}>Expanded</Select.Option>
              <Select.Option value={true}>Collapsed</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

