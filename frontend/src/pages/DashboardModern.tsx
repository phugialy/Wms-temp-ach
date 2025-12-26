import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Space,
  Typography,
  App,
  Spin,
  Alert,
  Divider,
} from 'antd';
import {
  ReloadOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  PlusOutlined,
  DatabaseOutlined,
  SearchOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { edgeFunctions } from '../services/edgeFunctions';
import { useToastStore } from '../stores/toastStore';

const { Title, Text } = Typography;

interface DashboardStats {
  totalItems: number;
  workingItems: number;
  failedItems: number;
  pendingItems: number;
  lastHour: number;
  lastDay: number;
}

interface CronJobTodayStats {
  date: string;
  totals: {
    devicesProcessed: number;
    devicesFound: number;
    devicesAdded: number;
    devicesFailed: number;
    executionCount: number;
  };
  jobs: Array<{
    scheduleId: string;
    name: string;
    workflowType: string;
    stations: string[];
    location: string;
    scheduleTime: string;
    frequency: string;
    isActive: boolean;
    today: {
      devicesFound: number;
      devicesProcessed: number;
      devicesAdded: number;
      devicesFailed: number;
      executionCount: number;
      lastExecution: string | null;
      status: string;
    };
    dailyTarget: number | null;
  }>;
}

export const DashboardModern = () => {
  const { message } = App.useApp();
  const addToast = useToastStore((state) => state.addToast);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [cronJobsStats, setCronJobsStats] = useState<CronJobTodayStats | null>(null);
  const [cronJobsLoading, setCronJobsLoading] = useState(false);

  const loadDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      // Try Edge Function first (faster)
      try {
        const response = await edgeFunctions.getInventoryStats();
        
        if (response.success && response.data) {
          const data = response.data;
          setStats({
            totalItems: data.total_items || 0,
            workingItems: data.working_items || 0,
            failedItems: data.failed_items || 0,
            pendingItems: data.pending_items || 0,
            lastHour: data.last_hour || 0,
            lastDay: data.last_day || 0,
          });
          return;
        }
      } catch (edgeError: any) {
        // Fallback to Express API
        console.debug('Edge Function failed, using Express API:', edgeError);
      }
      
      // Fallback to Express API
      try {
        const response = await api.get('/admin/inventory-stats');
        if (response.data && response.data.success) {
          const data = response.data.data;
          setStats({
            totalItems: data.total_items || 0,
            workingItems: data.working_items || 0,
            failedItems: data.failed_items || 0,
            pendingItems: data.pending_items || 0,
            lastHour: data.last_hour || 0,
            lastDay: data.last_day || 0,
          });
        }
      } catch (apiError: any) {
        if (apiError.response?.status !== 404) {
          throw apiError;
        }
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load dashboard data';
      setError(errorMessage);
      console.error('Failed to load dashboard data:', err);
      if (isRefresh) {
        message.error('Failed to refresh dashboard data');
      } else {
        addToast('Failed to load dashboard data. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCronJobsStats = async () => {
    try {
      setCronJobsLoading(true);
      const response = await fetch('/api/dashboard/cron-jobs-today');
      const result = await response.json();
      if (result.success && result.data) {
        setCronJobsStats(result.data);
      }
    } catch (err: any) {
      console.error('Failed to load cron jobs stats:', err);
    } finally {
      setCronJobsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    loadCronJobsStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadDashboardData(true);
      loadCronJobsStats();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const workingPercentage = stats && stats.totalItems > 0 
    ? Math.round((stats.workingItems / stats.totalItems) * 100) 
    : 0;
  const failedPercentage = stats && stats.totalItems > 0
    ? Math.round((stats.failedItems / stats.totalItems) * 100)
    : 0;
  const pendingPercentage = stats && stats.totalItems > 0
    ? Math.round((stats.pendingItems / stats.totalItems) * 100)
    : 0;

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh' 
      }}>
        <Spin size="large" tip="Loading dashboard data..." />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Unable to Load Dashboard"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={() => loadDashboardData()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Page Header */}
      <div style={{ 
        marginBottom: 24, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
            Dashboard
          </Title>
          <Text type="secondary" style={{ fontSize: 16 }}>
            Real-time inventory overview and analytics
          </Text>
        </div>
        <Button
          type="default"
          icon={<ReloadOutlined spin={refreshing} />}
          onClick={() => loadDashboardData(true)}
          loading={refreshing}
          size="large"
        >
          Refresh
        </Button>
      </div>

      {/* Key Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Items"
              value={stats?.totalItems || 0}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            {stats && stats.lastDay > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
                <RiseOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                <span style={{ color: '#52c41a', fontWeight: 500 }}>
                  +{stats.lastDay}
                </span>
                {' '}in last 24h
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Working Items"
              value={stats?.workingItems || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
              {workingPercentage}% of total
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Failed Items"
              value={stats?.failedItems || 0}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
              {failedPercentage}% of total
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pending Items"
              value={stats?.pendingItems || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
              {pendingPercentage}% of total
            </div>
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <PlusOutlined />
                Quick Actions
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Link to="/device-add" style={{ display: 'block', width: '100%' }}>
                <Card 
                  hoverable
                  style={{ 
                    border: '1px solid #f0f0f0',
                    transition: 'all 0.3s'
                  }}
                  bodyStyle={{ padding: 16 }}
                >
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space size="middle">
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <PlusOutlined style={{ fontSize: 20, color: 'white' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>Add Devices</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Add single or bulk devices to inventory
                        </Text>
                      </div>
                    </Space>
                    <ArrowRightOutlined style={{ color: '#8c8c8c' }} />
                  </Space>
                </Card>
              </Link>

              <Link to="/inventory" style={{ display: 'block', width: '100%' }}>
                <Card 
                  hoverable
                  style={{ 
                    border: '1px solid #f0f0f0',
                    transition: 'all 0.3s'
                  }}
                  bodyStyle={{ padding: 16 }}
                >
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space size="middle">
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <SearchOutlined style={{ fontSize: 20, color: 'white' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>View Inventory</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Browse and manage all inventory items
                        </Text>
                      </div>
                    </Space>
                    <ArrowRightOutlined style={{ color: '#8c8c8c' }} />
                  </Space>
                </Card>
              </Link>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <DatabaseOutlined />
                System Status
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '12px 16px',
                background: '#f5f5f5',
                borderRadius: 8
              }}>
                <Space>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#52c41a',
                    animation: 'pulse 2s infinite'
                  }} />
                  <Text strong>Database Connection</Text>
                </Space>
                <Text type="success" strong>Active</Text>
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '12px 16px',
                background: '#f5f5f5',
                borderRadius: 8
              }}>
                <Space>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#52c41a',
                    animation: 'pulse 2s infinite'
                  }} />
                  <Text strong>Edge Functions</Text>
                </Space>
                <Text type="success" strong>Available</Text>
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '12px 16px',
                background: '#f5f5f5',
                borderRadius: 8
              }}>
                <Space>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#1890ff'
                  }} />
                  <Text strong>API Endpoints</Text>
                </Space>
                <Text type="success" strong>Operational</Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Cron Jobs Today Section */}
      {cronJobsStats && (
        <>
          <Card 
            title={
              <Space>
                <ThunderboltOutlined />
                Cron Jobs - Today's Performance
              </Space>
            }
            style={{ marginBottom: 24 }}
            extra={
              <Button 
                size="small" 
                icon={<ReloadOutlined spin={cronJobsLoading} />}
                onClick={loadCronJobsStats}
                loading={cronJobsLoading}
              >
                Refresh
              </Button>
            }
          >
            {/* Total Devices Processed Today */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Total Devices Processed"
                    value={cronJobsStats.totals.devicesProcessed}
                    prefix={<PlayCircleOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                    {cronJobsStats.totals.executionCount} execution(s) today
                  </Text>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Devices Found"
                    value={cronJobsStats.totals.devicesFound}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Devices Added"
                    value={cronJobsStats.totals.devicesAdded}
                    prefix={<RiseOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Devices Failed"
                    value={cronJobsStats.totals.devicesFailed}
                    prefix={<CloseCircleOutlined />}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Individual Jobs Hero Grid */}
            <Divider orientation="left">
              <Text strong>Individual Jobs</Text>
            </Divider>
            <Row gutter={[16, 16]}>
              {cronJobsStats.jobs.map((job) => {
                const progress = job.dailyTarget 
                  ? Math.min((job.today.devicesProcessed / job.dailyTarget) * 100, 100)
                  : null;
                const statusColor = 
                  job.today.status === 'completed' ? '#52c41a' :
                  job.today.status === 'running' ? '#1890ff' :
                  job.today.status === 'failed' ? '#ff4d4f' : '#faad14';

                return (
                  <Col xs={24} sm={12} lg={8} xl={6} key={job.scheduleId}>
                    <Card
                      hoverable
                      style={{
                        height: '100%',
                        border: `2px solid ${statusColor}20`,
                        borderRadius: 8,
                      }}
                      bodyStyle={{ padding: 16 }}
                    >
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>
                              {job.name}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {job.location} • {job.scheduleTime}
                            </Text>
                          </div>
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: statusColor,
                              marginTop: 4,
                            }}
                          />
                        </div>

                        <Divider style={{ margin: '12px 0' }} />

                        <Row gutter={8}>
                          <Col span={12}>
                            <Statistic
                              title="Processed"
                              value={job.today.devicesProcessed}
                              valueStyle={{ fontSize: 20, fontWeight: 'bold' }}
                            />
                          </Col>
                          <Col span={12}>
                            <Statistic
                              title="Added"
                              value={job.today.devicesAdded}
                              valueStyle={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}
                            />
                          </Col>
                        </Row>

                        <div style={{ marginTop: 8 }}>
                          {job.dailyTarget ? (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Daily Target</Text>
                                <Text strong style={{ fontSize: 12 }}>
                                  {job.today.devicesProcessed} / {job.dailyTarget}
                                </Text>
                              </div>
                              <div
                                style={{
                                  height: 6,
                                  background: '#f0f0f0',
                                  borderRadius: 3,
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${progress}%`,
                                    background: progress! >= 100 ? '#52c41a' : '#1890ff',
                                    transition: 'width 0.3s',
                                  }}
                                />
                              </div>
                            </>
                          ) : (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Target: Calculating from historical data...
                            </Text>
                          )}
                        </div>

                        <div style={{ marginTop: 8, fontSize: 11, color: '#8c8c8c' }}>
                          <Text type="secondary">
                            Executions: {job.today.executionCount} • 
                            {job.today.lastExecution && (
                              <> Last: {new Date(job.today.lastExecution).toLocaleTimeString()}</>
                            )}
                          </Text>
                        </div>
                      </Space>
                    </Card>
                  </Col>
                );
              })}
            </Row>

            {cronJobsStats.jobs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">No active cron jobs found</Text>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Activity Summary */}
      <Card title="Activity Summary">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic
                title="Last Hour"
                value={stats?.lastHour || 0}
                prefix={<RiseOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Items added
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic
                title="Last 24 Hours"
                value={stats?.lastDay || 0}
                prefix={<RiseOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Items added
              </Text>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Add CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

