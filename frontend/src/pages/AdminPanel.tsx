import { useState } from 'react';
import { Card, Tabs, Row, Col, Statistic, Button, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { DbIntegrityCheck } from './DbIntegrityCheck';
import { CronJobManagementModern } from './CronJobManagementModern';

const { Title, Text } = Typography;

export const AdminPanel = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('overview');

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <DashboardOutlined />
          Overview
        </span>
      ),
      children: (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={8}>
              <Card
                hoverable
                onClick={() => setActiveTab('cron-jobs')}
                style={{ height: '100%', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ClockCircleOutlined style={{ fontSize: 24, color: 'white' }} />
                  </div>
                  <Button type="link" icon={<ExportOutlined />} />
                </div>
                <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
                  Cron Jobs
                </Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  Automated workflow scheduling
                </Text>
                <Button type="primary" block>
                  Manage Jobs <ArrowRightOutlined />
                </Button>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Card
                hoverable
                onClick={() => setActiveTab('db-integrity')}
                style={{ height: '100%', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <DatabaseOutlined style={{ fontSize: 24, color: 'white' }} />
                  </div>
                  <Button type="link" style={{ pointerEvents: 'none' }}>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  </Button>
                </div>
                <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
                  DB Integrity Check
                </Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  Scan and fix missing data
                </Text>
                <Button type="primary" block style={{ background: '#52c41a', borderColor: '#52c41a' }}>
                  Run Check <ArrowRightOutlined />
                </Button>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Card hoverable style={{ height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <DatabaseOutlined style={{ fontSize: 24, color: 'white' }} />
                  </div>
                </div>
                <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
                  Inventory
                </Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  Manage device inventory
                </Text>
                <Link to="/inventory">
                  <Button type="primary" block style={{ background: '#722ed1', borderColor: '#722ed1' }}>
                    Open Inventory <ExportOutlined />
                  </Button>
                </Link>
              </Card>
            </Col>
          </Row>

          {/* Quick Actions */}
          <Card title="Quick Actions">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card
                  hoverable
                  onClick={() => setActiveTab('cron-jobs')}
                  style={{ cursor: 'pointer', border: '2px solid #f0f0f0' }}
                  bodyStyle={{ padding: 20 }}
                >
                  <Space size="large">
                    <ClockCircleOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                    <div>
                      <Title level={5} style={{ margin: 0, marginBottom: 4 }}>
                        Manage Cron Jobs
                      </Title>
                      <Text type="secondary">Schedule and monitor automated workflows</Text>
                    </div>
                    <ArrowRightOutlined style={{ fontSize: 20, color: '#8c8c8c', marginLeft: 'auto' }} />
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card
                  hoverable
                  onClick={() => setActiveTab('db-integrity')}
                  style={{ cursor: 'pointer', border: '2px solid #f0f0f0' }}
                  bodyStyle={{ padding: 20 }}
                >
                  <Space size="large">
                    <DatabaseOutlined style={{ fontSize: 32, color: '#52c41a' }} />
                    <div>
                      <Title level={5} style={{ margin: 0, marginBottom: 4 }}>
                        Database Integrity Check
                      </Title>
                      <Text type="secondary">Scan and fix missing device data</Text>
                    </div>
                    <ArrowRightOutlined style={{ fontSize: 20, color: '#8c8c8c', marginLeft: 'auto' }} />
                  </Space>
                </Card>
              </Col>
            </Row>
          </Card>
        </div>
      ),
    },
    {
      key: 'cron-jobs',
      label: (
        <span>
          <ClockCircleOutlined />
          Cron Jobs
        </span>
      ),
      children: (
        <div style={{ margin: -24 }}>
          <CronJobManagementModern />
        </div>
      ),
    },
    {
      key: 'db-integrity',
      label: (
        <span>
          <DatabaseOutlined />
          DB Integrity Check
        </span>
      ),
      children: (
        <div style={{ margin: -24 }}>
          <DbIntegrityCheck />
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
          Admin Panel
        </Title>
        <Text type="secondary">Manage automation, database integrity, and system configuration</Text>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />
    </div>
  );
};

