import { useState } from 'react';
import { Card, Form, Input, Button, message, Tabs, Switch, Divider, Typography, Space, Avatar, Select } from 'antd';
import { UserOutlined, LockOutlined, BellOutlined, GlobalOutlined, SafetyOutlined, MailOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;

export const AccountSettings = () => {
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const user = useAuthStore((state) => state.user);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const handleProfileUpdate = async (values: any) => {
    setLoading(true);
    try {
      // Update user profile in wms_users table
      const { error } = await supabase
        .from('wms_users')
        .update({
          full_name: values.full_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (error) throw error;

      // Update auth store
      useAuthStore.getState().setUser({
        ...user!,
        name: values.full_name,
        full_name: values.full_name,
      });

      message.success('Profile updated successfully!');
    } catch (error: any) {
      message.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (values: any) => {
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.newPassword,
      });

      if (error) throw error;

      message.success('Password changed successfully!');
      passwordForm.resetFields();
    } catch (error: any) {
      message.error(error.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleNotificationSettings = async (values: any) => {
    // Save notification preferences to localStorage or backend
    localStorage.setItem('notification_preferences', JSON.stringify(values));
    message.success('Notification preferences saved!');
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Title level={2}>Account Settings</Title>
      <Text type="secondary">Manage your account settings and preferences</Text>

      <Tabs
        defaultActiveKey="profile"
        style={{ marginTop: 24 }}
        items={[
          {
            key: 'profile',
            label: (
              <span>
                <UserOutlined />
                Profile
              </span>
            ),
            children: (
          <Card>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Avatar size={100} style={{ backgroundColor: '#1890ff', marginBottom: 16 }}>
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </Avatar>
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    {user?.full_name || user?.name || 'User'}
                  </Title>
                  <Text type="secondary">{user?.email}</Text>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">Role: </Text>
                    <Text strong>{user?.role}</Text>
                  </div>
                </div>
              </div>

              <Divider />

              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  full_name: user?.full_name || user?.name || '',
                  email: user?.email || '',
                }}
                onFinish={handleProfileUpdate}
              >
                <Form.Item
                  label="Full Name"
                  name="full_name"
                  rules={[{ required: true, message: 'Please enter your full name' }]}
                >
                  <Input prefix={<UserOutlined />} placeholder="Enter your full name" />
                </Form.Item>

                <Form.Item label="Email" name="email">
                  <Input prefix={<MailOutlined />} disabled />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Email cannot be changed. Contact administrator to change your email.
                  </Text>
                </Form.Item>

                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    Update Profile
                  </Button>
                </Form.Item>
              </Form>
            </Space>
          </Card>
            ),
          },
          {
            key: 'security',
            label: (
              <span>
                <LockOutlined />
                Security
              </span>
            ),
            children: (
          <Card>
            <Title level={4}>Change Password</Title>
            <Text type="secondary">Update your password to keep your account secure</Text>

            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handlePasswordChange}
              style={{ marginTop: 24, maxWidth: 500 }}
            >
              <Form.Item
                label="Current Password"
                name="currentPassword"
                rules={[{ required: true, message: 'Please enter your current password' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Enter current password" />
              </Form.Item>

              <Form.Item
                label="New Password"
                name="newPassword"
                rules={[
                  { required: true, message: 'Please enter a new password' },
                  { min: 8, message: 'Password must be at least 8 characters' },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Enter new password" />
              </Form.Item>

              <Form.Item
                label="Confirm New Password"
                name="confirmPassword"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: 'Please confirm your new password' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Passwords do not match'));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Confirm new password" />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={passwordLoading}>
                  Change Password
                </Button>
              </Form.Item>
            </Form>

            <Divider />

            <Title level={4}>Two-Factor Authentication</Title>
            <Text type="secondary">Add an extra layer of security to your account</Text>
            <div style={{ marginTop: 16 }}>
              <Button icon={<SafetyOutlined />}>Enable 2FA</Button>
              <Text type="secondary" style={{ marginLeft: 16, fontSize: 12 }}>
                Coming soon
              </Text>
            </div>
          </Card>
            ),
          },
          {
            key: 'notifications',
            label: (
              <span>
                <BellOutlined />
                Notifications
              </span>
            ),
            children: (
          <Card>
            <Title level={4}>Notification Preferences</Title>
            <Text type="secondary">Choose how you want to be notified</Text>

            <Form
              layout="vertical"
              initialValues={{
                emailNotifications: true,
                pushNotifications: false,
                systemAlerts: true,
                weeklyReports: false,
              }}
              onFinish={handleNotificationSettings}
              style={{ marginTop: 24 }}
            >
              <Form.Item label="Email Notifications" name="emailNotifications" valuePropName="checked">
                <Switch />
                <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
                  Receive notifications via email
                </Text>
              </Form.Item>

              <Form.Item label="Push Notifications" name="pushNotifications" valuePropName="checked">
                <Switch />
                <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
                  Receive browser push notifications
                </Text>
              </Form.Item>

              <Form.Item label="System Alerts" name="systemAlerts" valuePropName="checked">
                <Switch />
                <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
                  Important system alerts and updates
                </Text>
              </Form.Item>

              <Form.Item label="Weekly Reports" name="weeklyReports" valuePropName="checked">
                <Switch />
                <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
                  Receive weekly summary reports
                </Text>
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Save Preferences
                </Button>
              </Form.Item>
            </Form>
          </Card>
            ),
          },
          {
            key: 'preferences',
            label: (
              <span>
                <GlobalOutlined />
                Preferences
              </span>
            ),
            children: (
          <Card>
            <Title level={4}>Application Preferences</Title>
            <Text type="secondary">Customize your experience</Text>

            <Form
              layout="vertical"
              initialValues={{
                language: 'en',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                dateFormat: 'MM/DD/YYYY',
                theme: 'light',
              }}
              style={{ marginTop: 24 }}
            >
              <Form.Item label="Language" name="language">
                <Select>
                  <Select.Option value="en">English</Select.Option>
                  <Select.Option value="es">Spanish</Select.Option>
                  <Select.Option value="fr">French</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item label="Timezone" name="timezone">
                <Select showSearch>
                  <Select.Option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </Select.Option>
                </Select>
              </Form.Item>

              <Form.Item label="Date Format" name="dateFormat">
                <Select>
                  <Select.Option value="MM/DD/YYYY">MM/DD/YYYY</Select.Option>
                  <Select.Option value="DD/MM/YYYY">DD/MM/YYYY</Select.Option>
                  <Select.Option value="YYYY-MM-DD">YYYY-MM-DD</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Button type="primary" onClick={() => message.info('Preferences saved!')}>
                  Save Preferences
                </Button>
              </Form.Item>
            </Form>
          </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

